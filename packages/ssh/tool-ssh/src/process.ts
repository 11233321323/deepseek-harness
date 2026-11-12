/**
 * Spawn the local OpenSSH client without a shell and bound its output.
 * @module @deepseek-ai/dsh-tool-ssh/process
 */

import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { SshToolError, redactSecrets } from './validate.ts'

/** Completed local OpenSSH process, with secrets removed from the captured text. */
export interface CapturedProcess {
  /** Process exit code, or null when a signal or timeout stopped it. */
  exitCode: number | null
  /** Signal that stopped the process, when one did. */
  signal: NodeJS.Signals | null
  /** Standard output after private-key redaction, possibly truncated. */
  stdout: string
  /** Standard error after private-key redaction, possibly truncated. */
  stderr: string
  /** True when either stream exceeded the byte cap. */
  truncated: boolean
  /** True when the timeout killed the process. */
  timedOut: boolean
}

/** Limits and cancellation for one local OpenSSH invocation. */
export interface RunCapturedOptions {
  /** Executable name or absolute path (`ssh` or `sftp`). */
  binary: string
  /** Argv after the executable. Must not be interpreted by a shell. */
  args: readonly string[]
  /** Tool-call cancellation. */
  signal: AbortSignal
  /** Deadline in milliseconds. */
  timeoutMs: number
  /** Maximum retained bytes of each stream. */
  maxOutputBytes: number
}

interface StreamCapture {
  text: string
  truncated: boolean
}

function capture(maxOutputBytes: number): { stream: StreamCapture; push(chunk: Buffer): void } {
  const stream: StreamCapture = { text: '', truncated: false }
  return {
    stream,
    push(chunk: Buffer) {
      if (stream.truncated) return
      const next = stream.text + chunk.toString('utf8')
      if (Buffer.byteLength(next) <= maxOutputBytes) {
        stream.text = next
        return
      }
      stream.truncated = true
      stream.text = next.slice(0, maxOutputBytes)
    },
  }
}

/**
 * Run one OpenSSH executable and return its redacted output.
 * @param options - executable, argv, deadline, and cancellation.
 * @returns the completed process.
 * @throws {SshToolError} `SSH_CLIENT_MISSING` when the executable cannot be found, or `SSH_FAILED` for another spawn error.
 */
export function runCaptured(options: RunCapturedOptions): Promise<CapturedProcess> {
  const stdout = capture(options.maxOutputBytes)
  const stderr = capture(options.maxOutputBytes)
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      const reason: unknown = options.signal.reason
      reject(reason instanceof Error ? reason : new Error('SSH call aborted'))
      return
    }
    const child = spawn(options.binary, options.args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let timedOut = false
    let settled = false
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal.removeEventListener('abort', onAbort)
      resolve({
        exitCode, signal, timedOut,
        stdout: redactSecrets(stdout.stream.text),
        stderr: redactSecrets(stderr.stream.text),
        truncated: stdout.stream.truncated || stderr.stream.truncated,
      })
    }
    const onAbort = () => {
      child.kill('SIGTERM')
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, options.timeoutMs)
    options.signal.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', (chunk: Buffer) => { stdout.push(chunk) })
    child.stderr.on('data', (chunk: Buffer) => { stderr.push(chunk) })
    child.once('error', (error: NodeJS.ErrnoException) => {
      /* v8 ignore next -- a close event can win the race with a late error */
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal.removeEventListener('abort', onAbort)
      if (error.code === 'ENOENT') {
        reject(new SshToolError(`OpenSSH executable not found: ${options.binary}`, 'SSH_CLIENT_MISSING', { cause: error }))
        return
      }
      reject(new SshToolError(`Could not start ${options.binary}: ${error.message}`, 'SSH_FAILED', { cause: error }))
    })
    child.once('close', (exitCode, signal) => { finish(exitCode, signal) })
  })
}

/**
 * Resolve when a local TCP port accepts a connection, or when the deadline passes.
 * @param port - loopback port to probe.
 * @param timeoutMs - how long to keep probing.
 * @param signal - cancellation.
 * @returns true when a connection succeeded.
 */
export async function localPortAccepts(port: number, timeoutMs: number, signal: AbortSignal): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (signal.aborted) return false
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: '127.0.0.1', port })
      const done = (value: boolean) => {
        socket.removeAllListeners()
        socket.destroy()
        resolve(value)
      }
      socket.once('connect', () => { done(true) })
      socket.once('error', () => { done(false) })
    })
    if (open) return true
    await new Promise((resolve) => { setTimeout(resolve, 30) })
  }
  return false
}
