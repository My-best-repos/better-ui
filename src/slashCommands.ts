export const SLASH_ALIASES: Record<string, string[]> = {
  "/menu": ["tui"],
  "/help": ["commands"],
  "/commands": ["commands"],
  "/changed": ["scan", "--changed"],
  "/staged": ["scan", "--staged"],
  "/doctor": ["doctor"],
  "/deps": ["deps"],
  "/a11y": ["check-accessibility"],

  "/fix-apply": ["fix", "--apply"],
  "/fix-interactive": ["fix", "--interactive"],
  "/advanced": ["advanced"],
  "/exit": ["exit"],
  "/seo": ["seo"],
  "/tech-debt": ["tech-debt"],
  "/performance": ["performance"],
  "/stack-audit": ["stack-audit"],
  "/migration": ["migration"],
  "/fe-score": ["fe-score"],
};

function tokenize(input: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? null : character;
      continue;
    }

    if (!quote && /\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function normalizeSlashArgv(argv: string[]) {
  // If no subcommand was provided, keep the argv array so commander shows help as before
  if (argv.length <= 2) {
    return argv;
  }

  const firstArg = argv[2];
  // Enforce "slash-only" global policy: the first command argument must start with '/'
  if (!firstArg.startsWith("/")) {
    // Provide a short, actionable error and exit. This enforces that all invocations use the
    // slash-prefixed form (eg. `better-ui-cli /scan`). We call process.exit here because this
    // function runs very early in CLI startup and it's the simplest enforcement point.
    console.error("Error: this CLI accepts only slash commands. Run commands that start with '/'.");
    console.error("Example: better-ui-cli /scan --format json --out tmp-report.json");
    // Use an explicit non-zero exit code to indicate misuse
    process.exit(2);
  }

  const mapped = SLASH_ALIASES[firstArg] || [firstArg.slice(1)];
  return [argv[0], argv[1], ...mapped, ...argv.slice(3)];
}

export function parseSlashCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    return null;
  }

  const mapped = SLASH_ALIASES[tokens[0]] || [tokens[0].slice(1)];
  return [...mapped, ...tokens.slice(1)];
}
