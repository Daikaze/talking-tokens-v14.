# Discord Voice Bridge — Talking Tokens V14 (Windows)

This folder is a **separate program** from the Foundry module. It runs on the GM's PC and sends Discord speaking indicators to Foundry. You **must keep it running while playing**.

## Requirements

- Node.js **24.17.0 or newer**, see https://nodejs.org/
- A Discord bot invited to your server with **View Channel** and **Connect** permissions for your voice channel
- The GM's Foundry browser and the bridge on the **same Windows computer** (WebSocket default: `127.0.0.1`)
- Discord users talk in the configured voice channel (normal voice channel, not Stage)

## Create bot and invite it

1. Go to https://discord.com/developers/applications and create a New Application (e.g. `Averis Talking Tokens`).
2. In **Bot**, create or reset a token, then keep the token secret.
3. Under **Installation/OAuth2**, configure a guild installation for the `bot` scope; grant only **View Channel** and **Connect**. Install the bot in your server. It does **not** need Administrator, Message Content intent or privileged intents.
4. In Discord **User Settings → Advanced → Developer Mode**, enable Developer Mode.
5. Right-click the server icon → **Copy Server ID**.
6. Right-click the D&D voice channel → **Copy Channel ID**.

## Configure Windows helper

1. Download the latest `discord-bridge.zip` from this repository's **Releases**, extract it somewhere persistent on the GM's Windows PC.
2. Double-click `start-windows.bat` once; it creates a `.env` file if missing.
3. Edit `.env` in Notepad:
   ```ini
   DISCORD_BOT_TOKEN=your_private_bot_token
   DISCORD_GUILD_ID=your_server_id
   DISCORD_VOICE_CHANNEL_ID=your_voice_channel_id
   BRIDGE_PORT=47944
   VOICE_RELEASE_MS=650
   ```
4. Save, double-click `start-windows.bat` again. It installs npm dependencies on first run.
5. Leave the black console window open during your game. Look for:
   ```
   [Discord] Signed in as ...
   [Voice] Ready. Talk in this channel to display token bubbles.
   [Bridge] Local WebSocket ready: ws://127.0.0.1:47944
   ```

## Connect Foundry to the bridge

1. Open Foundry V14 as GM in a browser **on the same PC** where the helper runs.
2. In **Talking Tokens V14 → Open Settings**, check **Connect to external voice bridge**.
3. Keep `ws://127.0.0.1:47944` as the WebSocket URL, then save.
4. For each player, map a Foundry user to the character Actor and put that Actor's token on the current scene.
5. In Discord, right-click each player's name → **Copy User ID** (Developer Mode required). Paste into that player's **Discord ID** box in Foundry and save.
6. Join the configured voice channel and speak. The bot also joins the channel. The token bubble should appear and disappear automatically.

### Troubleshooting

- **Test works, Discord doesn't:** Check helper window for `[Voice] Ready`, and for `[Voice] Start: ...` as someone speaks.
- **Voice Start logs, but no bubble:** Check `Discord ID` mapping and that the correct Actor token exists on the loaded Foundry scene. Confirm **Connect to external voice bridge** is checked and settings saved.
- **No Voice Start logs:** Verify the bot is **not deafened**, can **Connect** to the voice channel, and is in that same channel. `selfDeaf: false` is set in code.
- **WebSocket error or missing local connection:** Use the GM's browser on the helper's PC. Check Windows firewall and ensure port 47944 isn't already used.
- **Foundry uses HTTPS:** Some browser security policies may block a `ws://` connection; use an appropriately secured local setup or troubleshoot browser console.
- **Bot login failed:** Check the secret token (never send it in ChatGPT or commit it to a repository).
- **Node too old:** Install Node.js 24.17.0 or later.
- Discord voice receiver events rely on functionality not officially documented by Discord. Library updates or voice encryption changes can temporarily break activity detection.

### Privacy / security

- The bridge listens **only on 127.0.0.1**, not the public network.
- It emits Discord user IDs and speaking start/end indicators only. It never saves, records or decodes audio.
- Do not share `.env`, the token, or give the bot more server permissions than needed.
- Browser-to-localhost WebSocket access has inherent cross-origin concerns. Only run the bridge on a trusted PC/browser, and close it after the session.
- If you suspect token leakage, regenerate it in the Discord Developer Portal.


## Talking Tokens v0.2.0 details

- **Smoother voice activity:** After Discord reports speaking stopped, the helper waits `VOICE_RELEASE_MS` milliseconds (default 650 ms) before sending the final OFF event. If the person resumes during that gap the pending stop is cancelled.
- **Better status reporting:** The helper sends `{"type":"bridge-status","discordReady":true,"voiceReady":true}` once Discord voice connection is ready. Foundry v0.2.0 displays this in green.
- **Privacy:** Only Discord user IDs and speaking status are sent to the local Foundry browser; no audio samples are stored, decoded, or forwarded.
- **Updating:** Close the old bridge using Ctrl+C. Extract the new `discord-bridge.zip` over the existing helper folder, preserving your private `.env` file. Start the helper again. You may optionally add `VOICE_RELEASE_MS=650` to your existing `.env`.
