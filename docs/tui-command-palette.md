# TUI Command Palette

## What it does

The TUI command palette opens from the prompt with `Ctrl+Shift+S` or by typing `/commands`.

It shows a selectable list of slash commands sorted alphabetically, with short descriptions, so users can discover the available flows without leaving the command center.

The palette still lets you move down to reveal commands that are not visible yet. Once you have reached the real end of the command list, pressing the down arrow no longer wraps back to the top.

## Minimal commands to test

```bash
npx ts-node src/cli.ts /menu
```

Then test:

```text
Press Ctrl+Shift+S
Move with the arrow keys
Press Enter on a command such as /scan or /doctor
Type /commands and confirm that the same palette opens
```

## Notes

- The palette is intentionally non-destructive by itself; it only selects and runs a command.
- `/commands` is excluded from the palette list to avoid opening the palette recursively.
- The TUI dashboard shows popular flows and keyboard shortcuts before you type anything.
- If you type an invalid slash command, the TUI suggests the closest supported commands and avoids showing unrelated follow-up actions.
- The command list can continue scrolling until new commands have been revealed. Once the first or last real command is visible, the arrow keys stop there instead of looping.
- `Esc` exits from the main TUI prompt.
- `Ctrl+C` exits the TUI cleanly without printing readline stack traces.
