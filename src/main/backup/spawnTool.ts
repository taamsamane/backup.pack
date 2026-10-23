import { spawn } from 'child_process'
import { getLogger } from '../logging/logger'

/**
 * Run an external CLI with an args array (never a shell string).
 * Do not put secrets in `args` — use `env` or temp option files instead.
 */
export async function spawnTool(input: {
  bin: string
  args: string[]
  env?: NodeJS.ProcessEnv
  cwd?: string
}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.bin, input.args, {
      env: { ...process.env, ...input.env },
      cwd: input.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8')
    })
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const exit = code ?? 1
      if (exit !== 0) {
        getLogger('spawnTool').warn(
          { bin: input.bin, code: exit, stderr: stderr.slice(0, 2000) },
          'Tool exited non-zero'
        )
      }
      resolve({ stdout, stderr, code: exit })
    })
  })
}

export async function spawnToolOrThrow(input: {
  bin: string
  args: string[]
  env?: NodeJS.ProcessEnv
  cwd?: string
  label?: string
}): Promise<{ stdout: string; stderr: string }> {
  const result = await spawnTool(input)
  if (result.code !== 0) {
    const label = input.label ?? input.bin
    throw new Error(
      `${label} failed (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim() || 'no output'}`
    )
  }
  return { stdout: result.stdout, stderr: result.stderr }
}
