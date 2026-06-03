# User-Facing Copy & UX Guidelines

Branding and naming:

- Use `better-ui` as the product and repository name in prose, headings, and TUI branding.
- Use `better-ui-cli` for npm package references, install instructions, and shell command examples.
- Avoid using legacy names such as `Project Doctor`.

Tone and language:

- The product is developer-facing and terminal-first: prefer concise, actionable English copy for messages and prompts.
- The init assistant and TUI default to English but keep copy short and explicit.

Copy guidelines (examples):

- Success: "Saved report to report.html" (short, path included).
- Action prompt: "Apply ESLint autofixes to 3 files?" (include counts and preview location).
- Error: "Failed to parse tsconfig.json: <reason>" (include actionable hint).
- TUI Navigation: Use "Press 'a' to return to the dashboard, or '/' to type a new command directly:" for command pauses.
- TUI Exit: Use "Leaving better-ui. Bye see you soon 😊" when the user exits the CLI.

For internationalization and automated agents:

- Docs and repo-level instructions are authoritative for behavior. When crafting AI responses or automated messages, prefer the repo's phrasing in `docs/`.
