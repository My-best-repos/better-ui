import { test, expect } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

function runPnpm(args: string[], options: Parameters<typeof spawnSync>[2]) {
  // pnpm is the package manager for this project, resolve from PATH via shell
  return spawnSync('pnpm', args, { ...options, shell: true })
}

function runNpm(args: string[], options: Parameters<typeof spawnSync>[2]) {
  // npm is used to install the packed tarball (simulates end-user behavior)
  return spawnSync('npm', args, { ...options, shell: true })
}

// Integration test: ensure the package can be packed, installed in a new
// project and that the installed binary runs without immediately failing.
test(
  'pack -> install -> run binary',
  { timeout: 300_000 },
  () => {
    const repoRoot = process.cwd()

    // Run pnpm pack (prepack runs the build)
    const pack = runPnpm(['pack'], { encoding: 'utf8', timeout: 120_000 })
    if (pack.error) throw pack.error
    expect(pack.status).toBe(0)

    const out = String(pack.stdout || '').trim()
    const lines = out.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    const tarballName = lines[lines.length - 1]
    expect(tarballName.endsWith('.tgz')).toBeTruthy()
    const tarballPath = path.resolve(repoRoot, tarballName)
    expect(fs.existsSync(tarballPath)).toBeTruthy()

    // Create temporary project
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'better-ui-test-'))
    const init = runNpm(['init', '-y'], { cwd: tmp, encoding: 'utf8', timeout: 120_000 })
    expect(init.status).toBe(0)

    // Install the packed tarball
    const install = runNpm(
      ['install', tarballPath, '--no-audit', '--no-fund'],
      { cwd: tmp, encoding: 'utf8', timeout: 240_000 }
    )
    if (install.error) throw install.error
    expect(install.status).toBe(0)

    // Find the installed binary inside node_modules
    const installedBin = path.join(tmp, 'node_modules', 'better-ui-cli', 'bin', 'better-ui.js')
    expect(fs.existsSync(installedBin)).toBeTruthy()

    // Run the binary to ensure it starts and exits successfully for a simple command
    const run = spawnSync('node', [installedBin, '/commands'], { cwd: tmp, encoding: 'utf8', timeout: 30_000 })
    if (run.error) throw run.error
    if (run.status !== 0) {
      throw new Error([
        `Installed binary exited with code ${String(run.status)}`,
        `stdout:\n${run.stdout || '(empty)'}`,
        `stderr:\n${run.stderr || '(empty)'}`
      ].join('\n\n'))
    }

    // Cleanup tarball
    try { fs.unlinkSync(tarballPath) } catch (e) { /* ignore */ }
  }
)
