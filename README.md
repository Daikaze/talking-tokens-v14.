# Talking Tokens V14 — v0.2.0 Beta

**Talking Tokens** is a Foundry VTT V14 module that displays speech indicators over character tokens. The original **Test** button was confirmed working in the Averis D&D campaign. The new v0.2.0 features are packaged for live testing.

## Install or update Foundry

Go to **Add-on Modules → Install Module → Manifest URL**:

https://github.com/Daikaze/talking-tokens-v14./releases/latest/download/module.json

If already installed, use **Check for Updates → Update**, then restart Foundry and reopen the world.

## What's new in v0.2.0

1. **Custom bubble images** — Enter a Foundry Data path or press **Browse** for a PNG, WebP or GIF. The global image applies to everyone, unless a player has their own image. Clear the path to revert to the regular bubble.
2. **Animated bubbles** — Choose **pulse, float, bounce, glow or none**. Accessibility reduced-motion settings are respected.
3. **Per-player customization** — Each Foundry user can have their own bubble style, color, image, mapped Actor and Discord ID. Existing actor/Discord mappings are preserved when updating.
4. **Smoother voice detection** — The Windows helper waits about **650 milliseconds** after speech ends to prevent flickering between words. Can be configured with `VOICE_RELEASE_MS`.
5. **Bridge connection indicator** — A status indicator shows disabled, connecting, bridge connected, voice ready, or disconnected. Green means the bridge reports **Discord voice ready**.

Other available controls: size, position (six options), bubble hold time, GM visibility and an individual player Test button.

### Using custom art

Use the Foundry **File Picker** (the folder icon) and select an image already stored in Foundry's accessible Data directory. For example: `assets/Items/Yuma/my-bubble.webp`. Transparent PNG/WebP works best, and animated GIF files can be used.

Set a **Global custom bubble image** or a **Personal Bubble Image** for a specific player. Personal image takes precedence over global image. If neither is set, the module displays the selected built-in bubble style with the player's chosen color.

Click **Save Settings** to apply changes. Click the **Test** button next to a player to preview that actor's configured bubble on the current scene.

## Discord Bridge — GM PC

The bridge must run as a **separate program** on the PC where the GM opens Foundry. GitHub stores and distributes it but does not keep a bot online.

Download `discord-bridge.zip` from the **latest Release**:

https://github.com/Daikaze/talking-tokens-v14./releases/latest

For step-by-step setup, see [bridge/README.md](bridge/README.md). The bridge needs Node.js 24.17.0+, Discord bot credentials stored locally in `.env`, a server ID and the voice-channel ID. Keep the helper running during the session.

### Update existing bridge from v0.1.x

1. Stop the old helper with **Ctrl+C**.
2. Download the new `discord-bridge.zip` from Releases.
3. Extract the files into your existing bridge folder, replacing the helper files **but keep your original `.env`** and never upload/share it.
4. (Optional) Add `VOICE_RELEASE_MS=650` to `.env`.
5. Start `start-windows.bat` again. Node dependencies should already be installed.

## Discord linking

In the module settings, enable **Connect to external voice bridge**, and set `ws://127.0.0.1:47944`. Assign a Foundry Actor and Discord User ID to each player. Place the Actor's token on the active scene; players must talk in the configured Discord voice channel.

The bridge sends JSON like:

```json
{"type":"speaking","discordId":"123456789012345678","speaking":true}
```

and later `speaking:false`. The bridge also sends voice-ready status messages. No audio recordings are created.

## Diagnostics

Use **Test** to check bubbles without Discord. If the test works but voice does not, check the helper's console for voice start/end messages and verify that the correct Discord IDs are mapped to the Foundry players.

The receiving/speaking feature uses Discord voice-receive functionality which is not officially stable. Verify in your environment.

Repository: https://github.com/Daikaze/talking-tokens-v14.
