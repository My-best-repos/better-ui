# Security Notes & Guardrails

Core assumptions:

- better-ui is intentionally local-only. Product code does not perform outbound network calls.
- Do not introduce network-dependent features without explicit design and review.

Dependency hygiene:

- Run `npm audit` periodically. The repository currently audits cleanly at the last known state.

File system safety:

- All writes must be constrained to the project root. Use `src/projectPaths.ts` helpers to validate target paths.
- Report writers and workflow outputs should validate the final destination before creating directories or writing files.
- Slash-only top-level CLI entry keeps invocation paths explicit and reduces ambiguity between direct CLI commands and slash aliases.

Secrets and sensitive data:

- Do not commit secrets or credentials. If a configuration file must include sensitive data, document a secure alternative (env var, platform secret store) and avoid storing values in repo.

For automated agents:

- Automated tools must not exfiltrate repository data. Any automation that reads or writes files should follow the same path-safety rules and avoid logging secrets.
- Interactive terminal flows should exit cleanly without leaking stack traces for normal user actions such as `Esc` or `Ctrl+C`.
