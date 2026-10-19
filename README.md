# Talking Tokens V14 — v0.2.4 Beta

**Talking Tokens** is a Foundry VTT V14 module that displays speech indicators over character tokens. The original **Test** button was confirmed working in the Averis D&D campaign. The v0.2.x features are packaged for live testing.

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


## New in v0.2.1 — GM → NPC Voice Mode

**Make your NPCs appear to speak while you talk as GM:**

1. As GM, put the **Discord User ID of your own account** into your GM player row in Talking Tokens settings; save. You do NOT need to enable "Show for GM".
2. Select **exactly one NPC token** on the current scene.
3. Press **Shift+N** to arm that NPC. A small GM-only panel appears with its name and a Stop button.
4. **Talk normally in Discord** (with the existing Windows bridge connected). Your voice triggers that NPC bubble instead of the GM's character bubble. Players see the NPC talking.
5. Press **Shift+N** again with the same token selected, or click **Stop**, to disable. Select a different NPC and Shift+N to switch NPCs.

**Manual mode (no Discord needed):** After arming an NPC with Shift+N, hold **Shift+M** (or hold the panel's **Hold to Talk** button) to show its bubble. Release to stop. Keep Foundry focused for keyboard shortcuts.

The **Token Controls** menu has a **GM → NPC Voice** button as an alternative to Shift+N. The module settings also include Toggle and Stop buttons.

To customize keybinds, open **Game Settings → Configure Controls → Talking Tokens V14**.

The targeting uses the placed token's ID, so separate NPC instances can speak independently. When you leave the scene, the NPC mode disengages automatically. The hotkeys are only available to GMs. The selected NPC does not need a Discord ID of its own, since it speaks through your account.

**Note:** Discord must be connected for automatic voice activity. The manual Shift+M control works without a bot. This is a beta feature that should be verified with real players.

### v0.2.2 hotkey reliability

Shortcuts use Foundry V14's official modifier key constants. The manual speaking indicator also switches off on key release or when the Foundry window loses focus. The configured shortcuts can be changed under Configure Controls.


## v0.2.3 — Drag to move bubble / Hide GM voice bar

**Change the bubble location for any token (saved for the scene and seen by all players):**

1. Select ONE token as GM (or arm your NPC with Shift+N).
2. Press **Shift+B**, or click **Move bubble** on the GM NPC voice bar.
3. An editable bubble outlined in orange appears over the token. Drag it with your mouse to the desired position.
4. Release the mouse: the position is saved automatically on that placed token (as a TokenDocument flag). Click **Done** or press **Shift+B** again.
5. Use **Reset position** in the editor to restore the default position for that token.

The offset is measured in scene units and tracks token movement and canvas zoom. Other players see the changed position on their own canvases when the bubble is active. Each placed token can have a different offset, even when multiple tokens use the same NPC Actor.

**Hide the GM → NPC voice bar without disabling voice routing:**

- Press **Shift+H** while the Foundry canvas is focused to hide/show the bottom-left bar.
- Or click **×** on that bar to hide it.
- Or open **Game Settings → Module Settings → Show GM → NPC floating voice bar** and change the checkbox.
- Your current NPC voice routing remains active when the bar is hidden. Use Shift+N to stop or switch NPCs; hold Shift+M to speak manually even without the bar. Press Shift+H to restore the bar.

All three hotkeys are editable in **Game Settings → Configure Controls → Talking Tokens V14**. Bubble offset and position editor are GM-only; there is no need to change the Discord Bridge.


## v0.2.4 — GLOBAL bubble positioning + DIRECT resize

The default edit mode now changes **every token bubble everywhere**, rather than just the currently selected NPC. The NPC you select is only a visual preview.

1. Select one token on the current scene (or arm an NPC with **Shift+N**).
2. Press **Shift+B** (or click **Move bubble** on the GM panel; or the **Move / Resize All Bubbles** button in module settings).
3. The preview editor defaults to **Global — all bubbles**. Drag the bubble to change the global offset.
4. Drag the small **↘ orange handle at the bottom-right** of the bubble to scale the bubble directly. The current size is shown as a percentage.
5. Release the mouse. Offset and scale are saved to world module settings and applied to **all talking bubbles**, including players and NPCs, across scenes and clients.
6. Click **Done** or press Shift+B. **Reset** in Global mode restores centered placement and 100% size.

Optional: In the floating editor's **Apply to** dropdown, choose **This token only** to override position and scale for one placed token. These overrides are stored on the TokenDocument and follow that token. Reset in this mode removes per-token overrides and reverts to the global appearance.

Global offset **adds** to existing per-token offsets from v0.2.3 so all bubbles move when you adjust the global position. If an old token still appears offset from the rest, choose **This token only → Reset** once for that token.

The GM voice bar can still be hidden with **Shift+H** (voice routing stays active). Discord Bridge does **not** need to be reinstalled. Position and resize controls work without Discord.
