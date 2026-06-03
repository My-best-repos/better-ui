import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { isGitRepository, getCurrentBranch, getChangedFiles } from "../src/gitUtils";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-git-test-"));
  execSync("git init", { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: "ignore" });
  execSync("git commit --allow-empty -m 'initial'", { cwd: tmpDir, stdio: "ignore" });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function commitFile(relPath: string, content = "hello") {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  execSync(`git add "${relPath}"`, { cwd: tmpDir, stdio: "ignore" });
  execSync(`git commit -m "add ${relPath}"`, { cwd: tmpDir, stdio: "ignore" });
}

describe("isGitRepository", () => {
  it("returns true inside a git repo", () => {
    expect(isGitRepository(tmpDir)).toBe(true);
  });

  it("returns false when no .git directory", () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), "better-ui-no-git-"));
    try {
      expect(isGitRepository(bareDir)).toBe(false);
    } finally {
      fs.rmSync(bareDir, { recursive: true, force: true });
    }
  });
});

describe("getCurrentBranch", () => {
  it("returns the current branch name", () => {
    const branch = getCurrentBranch(tmpDir);
    expect(branch).toBeTruthy();
    expect(typeof branch).toBe("string");
  });
});

describe("getChangedFiles", () => {
  it("returns empty array when no changes", () => {
    commitFile("src/index.ts");
    const result = getChangedFiles(tmpDir, "changed");
    expect(result).toEqual([]);
  });

  it("returns modified files for changed scope", () => {
    commitFile("src/index.ts");
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "modified content", "utf8");
    const result = getChangedFiles(tmpDir, "changed");
    expect(result).toContain("src/index.ts");
  });
  
  it("returns staged files for staged scope", () => {
    commitFile("src/index.ts");
    fs.writeFileSync(path.join(tmpDir, "src", "new.ts"), "new file", "utf8");
    execSync("git add src/new.ts", { cwd: tmpDir, stdio: "ignore" });
    const result = getChangedFiles(tmpDir, "staged");
    expect(result).toContain("src/new.ts");
  });

  it("includes untracked files for changed scope", () => {
    commitFile("src/index.ts");
    fs.writeFileSync(path.join(tmpDir, "src", "untracked.ts"), "new", "utf8");
    const result = getChangedFiles(tmpDir, "changed");
    expect(result).toContain("src/untracked.ts");
  });
});
