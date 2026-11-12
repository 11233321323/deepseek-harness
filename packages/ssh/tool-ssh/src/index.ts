/**
 * Model-facing OpenSSH tool: remote commands, sftp copies, and local port forwards.
 * Authentication is the user's existing keys and agent. Passwords and private key
 * text are rejected. Every call asks for `danger-full-access` unless the session
 * is already there.
 * @module @deepseek-ai/dsh-tool-ssh
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { approveEscalation } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-user-approval'
import { defineTool, ToolArgsError } from '@deepseek-ai/dsh-tools'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import { localPortAccepts, runCaptured } from './process.ts'
import type { CapturedProcess } from './process.ts'
import {
  SshToolError, assertDestination, assertForwardHost, assertNoSecretMaterial, assertPort, assertTransferPath,
} from './validate.ts'

export const name = 'tool-ssh'
export const inject = ['tools', 'sandboxPolicy']

/** Local OpenSSH client locations and output bounds. */
export interface Config {
  /** `ssh` executable. Default: `ssh` on `PATH`. */
  sshPath?: string
  /** `sftp` executable. Default: `sftp` on `PATH`. */
  sftpPath?: string
  /** Deadline for one command or transfer, in milliseconds. */
  timeoutMs?: number
  /** Maximum retained bytes of each output stream. */
  maxOutputBytes?: number
}

/** Runtime configuration for the SSH tool. */
export const Config: z<Config> = z.object({
  sshPath: z.string().default('ssh'),
  sftpPath: z.string().default('sftp'),
  timeoutMs: z.natural().min(1).max(600_000).default(30_000),
  maxOutputBytes: z.natural().min(1).max(8 * 1024 * 1024).default(1024 * 1024),
})

const SSH_OPTIONS = [
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'PreferredAuthentications=publickey',
  '-o', 'NumberOfPasswordPrompts=0',
] as const

interface SshArgs {
  action: 'exec' | 'list' | 'upload' | 'download' | 'forward' | 'forward_stop'
  justification: string
  destination?: string
  command?: string
  remotePath?: string
  localPath?: string
  port?: number
  identityFile?: string
  localPort?: number
  remoteHost?: string
  remotePort?: number
  timeoutMs?: number
}

function resultText(value: unknown): string {
  return JSON.stringify(value)
}

function capturedBody(action: string, destination: string, captured: CapturedProcess) {
  return {
    action, destination,
    exitCode: captured.exitCode,
    signal: captured.signal,
    timedOut: captured.timedOut,
    truncated: captured.truncated,
    stdout: captured.stdout,
    stderr: captured.stderr,
  }
}

/**
 * Register the `ssh` tool.
 * @param ctx - plugin context with tools and sandbox policy.
 * @param config - client paths and output bounds.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const sshPath = config.sshPath ?? 'ssh'
  const sftpPath = config.sftpPath ?? 'sftp'
  const timeoutMs = config.timeoutMs ?? 30_000
  const maxOutputBytes = config.maxOutputBytes ?? 1024 * 1024
  const forwards = new Map<number, ChildProcess>()
  ctx.effect(() => () => {
    for (const child of forwards.values()) child.kill('SIGTERM')
    forwards.clear()
  })

  const approve = async (exec: ToolExecution, justification: string): Promise<void> => {
    const policy = ctx.sandboxPolicy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
    await approveEscalation({
      requestedMode: 'danger-full-access',
      effectiveMode: policy.mode,
      subject: 'SSH operation',
      justification,
    }, {
      approver: ctx.get('approval'),
      agent: exec.agent,
      callId: exec.callId,
      toolName: 'ssh',
      signal: exec.signal,
    })
    exec.signal.throwIfAborted()
  }

  ctx.tools.register(defineTool({
    name: 'ssh',
    description: 'Run a command or transfer files on a remote machine with the local OpenSSH client. '
      + 'Authentication uses existing keys and the SSH agent only: do not pass passwords or private key text. '
      + 'Every action needs approval unless the session is already danger-full-access. '
      + 'exec runs one remote command; list, upload, and download use sftp; forward opens a local port forward and forward_stop closes one. '
      + 'Hosts must already be in known_hosts. Do not send or print private keys or passwords.',
    parameters: {
      action: {
        type: 'string', required: true,
        enum: ['exec', 'list', 'upload', 'download', 'forward', 'forward_stop'],
        description: 'Operation to perform.',
      },
      justification: {
        type: 'string', required: true,
        description: 'One sentence telling the user what this remote operation does and why.',
      },
      destination: { type: 'string', description: 'OpenSSH destination (alias, host, or user@host) for every action except forward_stop.' },
      command: { type: 'string', description: 'Remote command for exec. The remote shell parses it; the local process does not.' },
      remotePath: { type: 'string', description: 'Remote path for list, upload, or download. list defaults to the login directory when omitted.' },
      localPath: { type: 'string', description: 'Local path for upload or download.' },
      port: { type: 'number', description: 'SSH server port. Omit to use the client default.' },
      identityFile: { type: 'string', description: 'Optional existing private-key file path. Omit to use the agent and default keys. Never pass key text.' },
      localPort: { type: 'number', description: 'Local loopback port for forward, or the port forward_stop closes.' },
      remoteHost: { type: 'string', description: 'Host reached from the remote machine for forward. Often 127.0.0.1.' },
      remotePort: { type: 'number', description: 'Port on remoteHost for forward.' },
      timeoutMs: { type: 'number', description: 'Deadline for exec, list, upload, or download. Forwards stay open until forward_stop.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    presentCall: args => args.action === 'exec'
      ? { card: 'terminal', title: args.command ?? 'ssh', description: args.justification }
      : { card: 'generic', title: `ssh ${args.action}`, kind: args.action === 'list' ? 'read' : 'other', rawInput: args.justification },
    async execute(args, exec) {
      if (args.justification.trim().length === 0) throw new ToolArgsError(['justification must be a non-empty sentence'])
      assertNoSecretMaterial(args.justification, 'justification')
      await approve(exec, args.justification)
      const deadline = resolveTimeout(args.timeoutMs, timeoutMs)
      switch (args.action) {
        case 'forward_stop':
          return stopForward(forwards, args.localPort)
        case 'exec':
          return runExec(exec, args, sshPath, deadline, maxOutputBytes)
        case 'list':
        case 'upload':
        case 'download':
          return runSftp(exec, args, sftpPath, deadline, maxOutputBytes)
        case 'forward':
          return startForward(exec, args, sshPath, forwards, deadline)
        /* v8 ignore start -- the tool schema rejects actions outside the declared enum before execute */
        default:
          throw new ToolArgsError([`unsupported action ${String(args.action)}`])
        /* v8 ignore stop */
      }
    },
  }))
}

function resolveTimeout(requested: number | undefined, fallback: number): number {
  if (requested === undefined) return fallback
  if (!Number.isFinite(requested) || requested <= 0 || requested > 600_000) {
    throw new ToolArgsError(['timeoutMs must be a positive number up to 600000'])
  }
  return requested
}

function clientArgs(args: SshArgs, destination: string, portFlag: '-p' | '-P'): string[] {
  const argv = [...SSH_OPTIONS]
  if (args.port !== undefined) argv.push(portFlag, String(assertPort(args.port, 'port')))
  if (args.identityFile !== undefined) argv.push('-i', assertTransferPath(args.identityFile, 'identityFile'))
  argv.push(destination)
  return argv
}

async function runExec(exec: ToolExecution, args: SshArgs, sshPath: string, timeoutMs: number, maxOutputBytes: number): Promise<string> {
  if (args.command === undefined || args.command.trim().length === 0) throw new ToolArgsError(['command is required for exec'])
  assertNoSecretMaterial(args.command, 'command')
  if (args.destination === undefined) throw new ToolArgsError(['destination is required'])
  const destination = assertDestination(args.destination)
  const captured = await runCaptured({
    binary: sshPath,
    args: [...clientArgs(args, destination, '-p'), args.command],
    signal: exec.signal,
    timeoutMs,
    maxOutputBytes,
  })
  return resultText(capturedBody('exec', destination, captured))
}

async function runSftp(exec: ToolExecution, args: SshArgs, sftpPath: string, timeoutMs: number, maxOutputBytes: number): Promise<string> {
  if (args.destination === undefined) throw new ToolArgsError(['destination is required'])
  const destination = assertDestination(args.destination)
  const remote = args.remotePath === undefined ? undefined : assertTransferPath(args.remotePath, 'remotePath')
  const local = args.localPath === undefined ? undefined : assertTransferPath(args.localPath, 'localPath')
  let batch: string
  if (args.action === 'list') batch = remote === undefined ? 'ls -l' : `ls -l ${remote}`
  else if (args.action === 'upload') {
    if (local === undefined || remote === undefined) throw new ToolArgsError(['upload requires localPath and remotePath'])
    batch = `put ${local} ${remote}`
  } else {
    if (local === undefined || remote === undefined) throw new ToolArgsError(['download requires remotePath and localPath'])
    batch = `get ${remote} ${local}`
  }
  const directory = await mkdtemp(join(tmpdir(), 'dshs-sftp-'))
  const file = join(directory, 'batch')
  try {
    await writeFile(file, `${batch}\n`, { mode: 0o600 })
    const captured = await runCaptured({
      binary: sftpPath,
      args: ['-b', file, ...clientArgs(args, destination, '-P')],
      signal: exec.signal,
      timeoutMs,
      maxOutputBytes,
    })
    return resultText(capturedBody(args.action, destination, captured))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function startForward(
  exec: ToolExecution, args: SshArgs, sshPath: string, forwards: Map<number, ChildProcess>, timeoutMs: number,
): Promise<string> {
  if (args.destination === undefined) throw new ToolArgsError(['destination is required'])
  const destination = assertDestination(args.destination)
  const localPort = assertPort(args.localPort ?? 0, 'localPort')
  const remoteHost = assertForwardHost(args.remoteHost ?? '')
  const remotePort = assertPort(args.remotePort ?? 0, 'remotePort')
  if (forwards.has(localPort)) throw new SshToolError(`local port ${String(localPort)} is already forwarded`, 'SSH_FORWARD_FAILED')
  const argv = [
    ...SSH_OPTIONS,
    '-N',
    '-o', 'ExitOnForwardFailure=yes',
    ...args.port === undefined ? [] : ['-p', String(assertPort(args.port, 'port'))],
    ...args.identityFile === undefined ? [] : ['-i', assertTransferPath(args.identityFile, 'identityFile')],
    '-L', `127.0.0.1:${String(localPort)}:${remoteHost}:${String(remotePort)}`,
    destination,
  ]
  const stderr: string[] = []
  const child = spawn(sshPath, argv, { shell: false, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
  child.stderr.on('data', (chunk: Buffer) => { stderr.push(chunk.toString('utf8')) })
  forwards.set(localPort, child)
  const closed = new Promise<number | null>((resolve) => { child.once('close', (code) => { resolve(code) }) })
  const ready = localPortAccepts(localPort, timeoutMs, exec.signal)
  const winner = await Promise.race([
    ready.then(open => ({ open, code: undefined as number | null | undefined })),
    closed.then(code => ({ open: false, code })),
  ])
  if (exec.signal.aborted) {
    forwards.delete(localPort)
    child.kill('SIGTERM')
    throw exec.signal.reason
  }
  if (!winner.open) {
    forwards.delete(localPort)
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    const detail = stderr.join('').slice(0, 4096).trim()
    throw new SshToolError(
      `port forward to ${destination} failed${detail === '' ? '' : `: ${detail}`}`,
      'SSH_FORWARD_FAILED',
    )
  }
  child.once('close', () => { forwards.delete(localPort) })
  return resultText({ action: 'forward', destination, localPort, remoteHost, remotePort })
}

function stopForward(forwards: Map<number, ChildProcess>, localPort: number | undefined): string {
  const port = assertPort(localPort ?? 0, 'localPort')
  const child = forwards.get(port)
  if (child === undefined) throw new SshToolError(`no forward is listening on local port ${String(port)}`, 'SSH_FORWARD_UNKNOWN')
  child.kill('SIGTERM')
  forwards.delete(port)
  return resultText({ action: 'forward_stop', localPort: port })
}
