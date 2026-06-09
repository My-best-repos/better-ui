# TUI Slash Actions

## What it does

The TUI is now slash-first and prompt-first.

Instead of a fixed menu selector, the main screen asks for a slash command directly. Users can type commands such as `/scan` or `/fix --interactive` in place.

For discoverability, `Ctrl+Shift+S` and `/commands` both open the command palette, where users can browse and select commands without leaving the TUI.

## Available slash actions

- `/scan`
- `/changed`
- `/staged`
- `/fix`
- `/fix-preview`
- `/fix-apply`
- `/fix-interactive`
- `/health`
- `/doctor`
- `/hotspots`
- `/a11y`
- `/explain`
- `/images`
- `/seo`
- `/tech-debt`
- `/performance`
- `/stack-audit`
- `/migration`
- `/fe-score`
- `/init`
- `/ui-typography`
- `/ui-spacing`
- `/commands`
- `/help`
- `/menu`
- `/exit`

## Minimal commands to test

```bash
npx ts-node src/cli.ts /menu
```

Then test these flows:

```text
type /scan and press Enter, then press `/` to type another command or `a` to return
type /fix-preview and press Enter
press Ctrl+Shift+S to open the command palette
type /commands to open the same palette
press Esc to leave the TUI
```

## Notes

- Some slash commands map to an existing CLI command plus flags. For example, `/fix-apply` maps to `fix --apply`.
- `/exit` is available from the prompt as a command, while `Esc` and `Ctrl+C` are handled as clean TUI exits.
- The canonical mapping lives in `src/slashCommands.ts`.
