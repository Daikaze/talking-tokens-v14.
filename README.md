# Talking Tokens V14 — Beta

A Foundry VTT **V14** module with animated speech bubbles above linked character tokens. Tested by the campaign GM: **manual Test button displays bubbles successfully**.

### Features

- Five bubble styles, six positions, size and hold-time controls
- Foundry user → Actor linking, Discord user ID mapping
- Local **Discord Voice Bridge** to show who is speaking automatically
- Displays bubbles for all Foundry players on the current scene
- Automatic GitHub Release builds

## 1. Install the Foundry module

Use **Add-on Modules → Install Module → Manifest URL**:

https://github.com/Daikaze/talking-tokens-v14./releases/latest/download/module.json

Enable the module in the world. Open **Settings → Module Settings → Talking Tokens V14 → Open Settings**. Select the Actor for each player, save, place that Actor's token on the current scene, and use the **Test** button.

## 2. Install the optional Discord Bridge (Windows GM PC)

The bridge must run separately **on the same computer as the GM's Foundry browser**. GitHub hosts the code but does not run the bot for you.

[Open GitHub Releases to get discord-bridge.zip](https://github.com/Daikaze/talking-tokens-v14./releases/latest)

Read the detailed setup instructions in [bridge/README.md](bridge/README.md).

Short setup:

1. Install **Node.js 24.17.0+** on the GM's Windows PC.
2. Create your bot in the [Discord Developer Portal](https://discord.com/developers/applications) and invite it to the server with **View Channel** and **Connect** voice-channel permissions only.
3. Download and extract `discord-bridge.zip` from **Releases**.
4. Start `start-windows.bat` once to create `.env`. Edit `.env` with **DISCORD_BOT_TOKEN**, **DISCORD_GUILD_ID** and **DISCORD_VOICE_CHANNEL_ID**. **Never share or upload your bot token.**
5. Run `start-windows.bat` again and keep the console window open during D&D.
6. In Foundry settings, check **Connect to external voice bridge**, keep URL `ws://127.0.0.1:47944`, and map each Foundry player to their Discord **User ID** (Discord Developer Mode → right-click user → Copy User ID).
7. Save settings and test by talking in the same Discord voice channel as the bot.

The bridge sends a message containing a Discord ID and a `speaking` true/false value. While Discord reports someone speaking, the bridge refreshes the indicator every 750ms so it stays visible. When they stop, the bubble disappears.

### Current limitations

- The Foundry module and manual Test work; **Discord bridge has not yet been tested with the actual Discord bot in this campaign**.
- Discord voice *receive* events are not officially documented by Discord and may break after Discord/client library changes.
- Only **one configured regular Discord voice channel** is watched, and only while the Windows helper is running.
- The helper binds to **127.0.0.1**. The GM's browser must run on the helper's PC; remote hosting requires different security/networking.
- It only processes speaking activity; **no audio files are written or decoded**.
- Do not commit a real `.env` file or token to GitHub.

### Manual diagnostics (GM browser F12 console)

```js
game.modules.get("talking-tokens-v14").api.openSettings()
```

```js
game.modules.get("talking-tokens-v14").api.test("FOUNDRY_USER_ID")
```

The Foundry install bundle is `module.zip`; the optional helper is `discord-bridge.zip`. Both are published by [GitHub Actions](https://github.com/Daikaze/talking-tokens-v14./actions).
