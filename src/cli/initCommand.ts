import { prompt } from "enquirer";
import fs from "fs";
import path from "path";
import { getConfigPath } from "../config";
import { getPresetById, PRESETS } from "../presets";

export async function runInit(projectRoot: string, options?: { preset?: string }) {
  const hasTsconfig = fs.existsSync(path.join(projectRoot, "tsconfig.json"));
  const initialPreset = getPresetById(options?.preset) || getPresetById(hasTsconfig ? "react" : "landing-page") || PRESETS[0];

  const responses: any = await prompt([
    {
      type: "input",
      name: "projectName",
      message: "Project name",
      initial: path.basename(projectRoot)
    },
    {
      type: "select",
      name: "preset",
      message: "Which setup preset fits this project best?",
      choices: PRESETS.map(preset => ({ name: preset.id, message: `${preset.label} - ${preset.description}`, value: preset.id })),
      initial: Math.max(0, PRESETS.findIndex(preset => preset.id === initialPreset.id))
    },
    {
      type: "select",
      name: "stack",
      message: "Which project type should be scanned by default?",
      choices: [
        { name: "javascript", message: "JavaScript / JSX", value: "javascript" },
        { name: "typescript", message: "TypeScript / TSX", value: "typescript" }
      ],
      initial: hasTsconfig ? 1 : 0
    },
    {
      type: "input",
      name: "reportFile",
      message: "Default JSON report path",
      initial: initialPreset.reportFile
    },
    {
      type: "toggle",
      name: "addScripts",
      message: "Add helper scripts to package.json?",
      initial: true
    },
    {
      type: "input",
      name: "scanCmd",
      message: "Command used for scanning",
      initial: initialPreset.scanCommand
    },
    {
      type: "input",
      name: "fixCmd",
      message: "Command used for fixes",
      initial: initialPreset.fixCommand
    },
    {
      type: "toggle",
      name: "openTui",
      message: "Open the guided terminal UI when setup finishes?",
      initial: true
    }
  ]);

  const selectedPreset = getPresetById(responses.preset) || initialPreset;
  const jsPresetExtensions = selectedPreset.extensions.filter(extension => extension === ".js" || extension === ".jsx");
  const defaultExtensions = responses.stack === "typescript"
    ? [...new Set([".js", ".jsx", ".ts", ".tsx", ...selectedPreset.extensions])]
    : [...new Set(jsPresetExtensions.length > 0 ? jsPresetExtensions : [".js", ".jsx"])];

  const config = {
    projectName: responses.projectName,
    preset: selectedPreset.id,
    defaults: {
      reportFile: responses.reportFile,
      extensions: defaultExtensions
    },
    scripts: {
      scan: responses.scanCmd,
      fix: responses.fixCmd
    }
  };

  const configPath = getConfigPath(projectRoot);
  await import("../reporters/markdownWriter").then(m => m.writeMarkdownReport(projectRoot, configPath, JSON.stringify(config, null, 2), { keepTxt: true }));

  if (responses.addScripts) {
    const pkgPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts["better-ui:scan"] = responses.scanCmd;
        pkg.scripts["better-ui:fix"] = responses.fixCmd;
        pkg.scripts["better-ui:health"] = "better-ui-cli /health";
        pkg.scripts["better-ui:doctor"] = "better-ui-cli /doctor";
        pkg.scripts["better-ui:a11y"] = "better-ui-cli /a11y";
        pkg.scripts["better-ui:review"] = "better-ui-cli /review --changed";
        pkg.scripts["better-ui:pr-summary"] = "better-ui-cli /pr-summary --out pr-summary.md";
        pkg.scripts["better-ui:init"] = "better-ui-cli /init";
        pkg.scripts["better-ui:tui"] = "better-ui-cli /menu";
        await import("../reporters/markdownWriter").then(m => m.writeMarkdownReport(projectRoot, pkgPath, JSON.stringify(pkg, null, 2), { keepTxt: true }));
        console.log("Added scripts to package.json: better-ui:scan, better-ui:fix, better-ui:health, better-ui:doctor, better-ui:a11y, better-ui:review, better-ui:pr-summary, better-ui:init, better-ui:tui");
      } catch (err) {
        console.warn("Could not modify package.json:", err);
      }
    }
  }

  console.log(`Created ${configPath}. You can edit defaults like reportFile and extensions later.`);
  return { openTui: Boolean(responses.openTui) };
}
