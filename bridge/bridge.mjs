/**
 * Talking Tokens — local Discord speech-activity bridge.
 *
 * Runs on the same Windows machine as the GM's Foundry browser.
 * Joins ONE configured voice channel, watches SPEAKING start/end events,
 * and relays Discord user IDs to Foundry over a localhost-only WebSocket.
 *
 * No messages, audio samples or recordings are stored or decoded.
 * Discord voice RECEIVE behavior is undocumented and may change.
 */
import "dotenv/config";
import { Client, Events, GatewayIntentBits, ChannelType } from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";
import { WebSocketServer, WebSocket } from "ws";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();
const channelId = process.env.DISCORD_VOICE_CHANNEL_ID?.trim();
const port = Number.parseInt(process.env.BRIDGE_PORT || "47944", 10);
const host = "127.0.0.1";
// Suppress brief speaking gaps, without introducing delay at the start.
const releaseMs = Math.min(1800, Math.max(0,
  Number.parseInt(process.env.VOICE_RELEASE_MS || "650", 10) || 0
));

if (!token || !guildId || !channelId) {
  console.error("[Bridge] Missing DISCORD_BOT_TOKEN, DISCORD_GUILD_ID or DISCORD_VOICE_CHANNEL_ID in .env.");
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("[Bridge] BRIDGE_PORT must be between 1024 and 65535.");
  process.exit(1);
}

const server = new WebSocketServer({
  host,
  port,
  maxPayload: 1024,
});
const clients = new Set();
const speaking = new Set();
const releaseTimers = new Map();
let connection = null;
let reconnectTimer = null;
let connecting = false;
let quitting = false;

function event(discordId, isSpeaking) {
  return JSON.stringify({ type: "speaking", discordId, speaking: isSpeaking });
}
function sendToAll(message) {
  for (const socket of clients) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    try {
      socket.send(message);
    } catch (error) {
      console.warn("[Bridge] WebSocket send failed:", error.message);
    }
  }
}
function statusEvent() {
  return JSON.stringify({
    type: "bridge-status",
    discordReady: discord.isReady(),
    voiceReady: connection?.state?.status === VoiceConnectionStatus.Ready
  });
}
function sendStatus() {
  sendToAll(statusEvent());
}
function clearReleaseTimer(id) {
  const timer = releaseTimers.get(id);
  if (timer) clearTimeout(timer);
  releaseTimers.delete(id);
}
function scheduleSpeakingEnd(id) {
  clearReleaseTimer(id);
  releaseTimers.set(id, setTimeout(() => {
    releaseTimers.delete(id);
    markSpeaking(id, false);
  }, releaseMs));
}
function markSpeaking(discordId, isSpeaking) {
  // Do not forward bots or our own identity as "players".
  if (discordId === discord.user?.id) return;
  if (isSpeaking) clearReleaseTimer(discordId);
  const wasSpeaking = speaking.has(discordId);
  if (isSpeaking && !wasSpeaking) {
    speaking.add(discordId);
    console.log("[Voice] Start:", discordId);
    sendToAll(event(discordId, true));
  } else if (!isSpeaking && wasSpeaking) {
    speaking.delete(discordId);
    console.log("[Voice] End:", discordId);
    sendToAll(event(discordId, false));
  }
}
function clearSpeakers() {
  for (const id of [...releaseTimers.keys()]) clearReleaseTimer(id);
  for (const id of [...speaking]) markSpeaking(id, false);
}

server.on("connection", (socket, request) => {
  // Bound to 127.0.0.1; no network clients can connect directly.
  // Extra limit prevents accepting proxied connections through unusual local hosts.
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) {
    socket.close(1008, "Local access only");
    return;
  }
  clients.add(socket);
  console.log("[Bridge] Foundry connected. Clients:", clients.size);
  // Report bridge + voice status immediately upon connection.
  socket.send(statusEvent());
  // Restore current speaking state if the GM reloads Foundry.
  for (const id of speaking) socket.send(event(id, true));
  socket.on("close", () => {
    clients.delete(socket);
    console.log("[Bridge] Foundry disconnected. Clients:", clients.size);
  });
  socket.on("message", () => {
    // One-way bridge; external commands are intentionally ignored.
  });
  socket.on("error", error => console.warn("[Bridge] WebSocket client:", error.message));
});

server.on("listening", () => {
  console.log("[Bridge] Local WebSocket ready: ws://" + host + ":" + port);
});
server.on("error", error => {
  console.error("[Bridge] WebSocket server error:", error.message);
  console.error("[Bridge] Another bridge may already be using port", port);
  process.exitCode = 1;
  void shutdown();
});

// Hold a long speaking session visible. The Foundry module has a timeout
// so the bridge reaffirms all active speakers every 750 ms.
const heartbeat = setInterval(() => {
  for (const id of speaking) sendToAll(event(id, true));
}, 750);
heartbeat.unref();

const discord = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

function scheduleReconnect(reason) {
  if (quitting || reconnectTimer) return;
  console.warn("[Voice] " + reason + "; retry in 5 seconds.");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectVoice();
  }, 5000);
}
function disposeConnection() {
  clearSpeakers();
  if (!connection) return;
  const old = connection;
  connection = null;
  sendStatus();
  old.removeAllListeners("stateChange");
  old.removeAllListeners("error");
  try {
    if (old.state.status !== VoiceConnectionStatus.Destroyed) old.destroy();
  } catch (error) {
    console.warn("[Voice] Could not destroy old connection:", error.message);
  }
}

async function connectVoice() {
  if (quitting || connecting || !discord.isReady()) return;
  connecting = true;
  try {
    disposeConnection();
    const channel = await discord.channels.fetch(channelId);
    if (!channel || channel.guildId !== guildId || channel.type !== ChannelType.GuildVoice) {
      throw new Error("Channel ID must point to a normal voice channel in the configured guild.");
    }
    console.log("[Voice] Connecting to:", channel.name);
    const voice = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,   // REQUIRED to receive speaking activity.
      selfMute: true,    // The bot never speaks.
    });
    connection = voice;
    sendStatus();
    voice.on("error", error => {
      console.warn("[Voice] Connection error:", error.message);
      scheduleReconnect("Voice connection error");
    });
    voice.on("stateChange", (_old, next) => {
      if (voice !== connection) return;
      console.log("[Voice] State:", next.status);
      sendStatus();
      if (next.status === VoiceConnectionStatus.Disconnected || next.status === VoiceConnectionStatus.Destroyed) {
        clearSpeakers();
        scheduleReconnect("Voice disconnected");
      }
    });

    await entersState(voice, VoiceConnectionStatus.Ready, 20000);
    // Receives speaking indicator events only: never subscribe() to audio.
    voice.receiver.speaking.on("start", id => markSpeaking(id, true));
    voice.receiver.speaking.on("end", id => scheduleSpeakingEnd(id));
    console.log("[Voice] Ready. Talk in this channel to display token bubbles.");
  } catch (error) {
    console.error("[Voice] Could not join:", error.message);
    scheduleReconnect("Join failed");
  } finally {
    connecting = false;
  }
}

discord.once(Events.ClientReady, client => {
  console.log("[Discord] Signed in as", client.user.tag);
  void connectVoice();
});
discord.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.channelId === channelId &&
      (newState.channelId !== channelId || newState.selfMute || newState.serverMute)) {
    clearReleaseTimer(oldState.id);
    markSpeaking(oldState.id, false);
  }
  if (oldState.id === discord.user?.id && oldState.channelId === channelId &&
      newState.channelId !== channelId) {
    scheduleReconnect("Bot left the configured voice channel");
  }
});
discord.on("error", error => console.error("[Discord] Client error:", error.message));
discord.on("shardDisconnect", () => {
  clearSpeakers();
  sendStatus();
  scheduleReconnect("Discord gateway disconnected");
});

async function shutdown() {
  if (quitting) return;
  quitting = true;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  disposeConnection();
  for (const socket of clients) socket.close();
  await new Promise(resolve => server.close(resolve));
  discord.destroy();
}

for (const name of ["SIGINT", "SIGTERM"]) {
  process.once(name, () => {
    console.log("\n[Bridge] Shutting down...");
    void shutdown().then(() => process.exit(process.exitCode || 0));
  });
}

discord.login(token).catch(error => {
  console.error("[Discord] Login failed:", error.message);
  console.error("[Discord] Check your bot token in bridge/.env (never commit or share it).");
  process.exitCode = 1;
  void shutdown();
});
