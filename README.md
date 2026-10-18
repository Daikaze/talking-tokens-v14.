# Talking Tokens V14 — Beta

A Foundry VTT **V14** module that displays animated speech bubbles over tokens, with a GM settings panel and optional WebSocket bridge input.

> **Beta:** Not yet tested in a live Foundry V14 instance. **Discord speaker detection is not included.** To get automatic speech detection, you must run a separate bridge that provides speaker events.

## Install using Foundry

Use **Add-on Modules → Install Module → Manifest URL**:

https://github.com/Daikaze/talking-tokens-v14./releases/latest/download/module.json

The first GitHub Actions release must complete before the link works.

## Setup

Activate the module in your D&D world. Go to **Game Settings → Module Settings → Talking Tokens V14 → Open Settings**. Map a Foundry user to an actor, put that actor's token on the scene, and click **Test**. Choose bubble style, size and position.

## Optional voice bridge

Enable **Connect to external voice bridge** on the GM's machine. The bridge must provide a WebSocket server (default `ws://127.0.0.1:47944`) sending messages like:

```json
{"type":"speaking","discordId":"123456789012345678","speaking":true}
```

Then a second message with `"speaking":false` when the user stops. Messages can also use `userId` (Foundry ID) or `playerName`. For privacy and security, only point the module at a bridge you trust.

## Macros

Use from the GM's browser console:

```js
game.modules.get("talking-tokens-v14").api.openSettings()
```

```js
game.modules.get("talking-tokens-v14").api.test("FOUNDRY_USER_ID")
```

## Updates / release workflow

Pushes to `main` generate release assets using GitHub Actions. The published release has a manifest with a pinned ZIP download and a stable manifest URL.

Repository: https://github.com/Daikaze/talking-tokens-v14.

## Notes

- Requires Foundry V14, designed for the D&D 5e world.
- Browser microphone/Discord voice access is **not** requested.
- Bubble positions track token positions during canvas pan and zoom.
- Bridge availability, browser mixed-content security and actual V14 behavior require in-environment testing.
