interface Preset {
  id: string;
  label: string;
  description: string;
  reportFile: string;
  extensions: string[];
  scanCommand: string;
  fixCommand: string;
}

export const PRESETS: Preset[] = [
  {
    id: "react",
    label: "React",
    description: "Typical React app (CRA / Vite / Next)",
    reportFile: "better-ui-report.txt",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    scanCommand: "better-ui-cli /scan",
    fixCommand: "better-ui-cli /fix --apply"
  },
  {
    id: "next",
    label: "Next.js",
    description: "Next.js application conventions",
    reportFile: "better-ui-report.txt",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    scanCommand: "better-ui-cli /scan",
    fixCommand: "better-ui-cli /fix --apply"
  },
  {
    id: "vite",
    label: "Vite",
    description: "Vite-powered app",
    reportFile: "better-ui-report.txt",
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    scanCommand: "better-ui-cli /scan",
    fixCommand: "better-ui-cli /fix --apply"
  },
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Simple static landing page projects",
    reportFile: "better-ui-report.txt",
    extensions: [".js", ".jsx"],
    scanCommand: "better-ui-cli /scan",
    fixCommand: "better-ui-cli /fix --apply"
  },
  {
    id: "typescript-library",
    label: "TypeScript Library",
    description: "Library published in TypeScript",
    reportFile: "better-ui-report.txt",
    extensions: [".ts", ".tsx"],
    scanCommand: "better-ui-cli /scan",
    fixCommand: "better-ui-cli /fix --apply"
  }
];

export function getPresetById(id?: string) {
  if (!id) return undefined;
  return PRESETS.find(p => p.id === id);
}
