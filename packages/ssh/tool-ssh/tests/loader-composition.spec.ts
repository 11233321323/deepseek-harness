/**
 * Boots the SSH tool through the Loader and runs it against a fake OpenSSH client.
 */
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { apply as applySsh, name as sshPluginName } from '@deepseek-ai/dsh-tool-ssh'
import * as ToolSsh from '@deepseek-ai/dsh-tool-ssh'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function fakeClient(directory: string): Promise<{ ssh: string; sftp: string; log: string }> {
  const script = join(directory, 'fake-ssh.mjs')
  const log = join(directory, 'argv.log')
  await writeFile(script, `
import { appendFileSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
const log = ${JSON.stringify(log)}
const args = process.argv.slice(2)
appendFileSync(log, JSON.stringify(args) + '\\n')
const batchAt = args.indexOf('-b')
if (batchAt !== -1) {
  appendFileSync(log, 'BATCH ' + readFileSync(args[batchAt + 1], 'utf8'))
  process.exit(0)
}
if (args.includes('-N')) {
  const destination = args[args.length - 1]
  if (destination === 'exit-now') { process.stderr.write('refused\\n'); process.exit(1) }
  if (destination === 'exit-quiet') process.exit(1)
  if (destination === 'sleep') { setInterval(() => {}, 1000); }
  else {
  const spec = args[args.indexOf('-L') + 1]
  const port = Number(/^127\\.0\\.0\\.1:(\\d+):/.exec(spec)?.[1])
  const server = createServer((socket) => { socket.end() })
  server.listen(port, '127.0.0.1')
  const stop = () => { server.close(); process.exit(0) }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  }
} else {
  process.stdout.write('remote-ok\\n')
}
`)
  const launch = process.platform === 'win32' ? join(directory, 'fake-ssh.cmd') : join(directory, 'fake-ssh')
  if (process.platform === 'win32') {
    await writeFile(launch, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`)
  } else {
    await writeFile(launch, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 })
    await chmod(launch, 0o755)
  }
  return { ssh: launch, sftp: launch, log }
}

async function boot(mode: 'danger-full-access' | 'read-only', clients?: { ssh: string; sftp: string }): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dshs-ssh-loader-'))
  const configPath = join(root, 'cordis.yml')
  const clientLines = clients === undefined ? [] : [
    '  config:',
    `    sshPath: ${JSON.stringify(clients.ssh)}`,
    `    sftpPath: ${JSON.stringify(clients.sftp)}`,
    '    timeoutMs: 2000',
  ]
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-sandbox-policy'",
    '  config:',
    `    mode: ${mode}`,
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-tool-ssh'",
    ...clientLines,
    '',
  ].join('\n'))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-sandbox-policy', SandboxPolicy],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-tool-ssh', ToolSsh],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      const loaded = modules.get(specifier)
      if (loaded === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return loaded
    },
  }
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return ctx
}

function textOf(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

async function call(ctx: Context, args: Record<string, unknown>) {
  return executeToolFixture(ctx, {
    signal: new AbortController().signal,
    callId: ToolCallId('ssh-call'),
    name: 'ssh',
    arguments: args,
  })
}

describe('ssh tool through the Loader', () => {
  it('uses built-in client names when config omits them', async () => {
    const ctx = new Context()
    context = ctx
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access' })
    await ctx.plugin(ToolRuntime)
    applySsh(ctx, {})
    expect(sshPluginName).toBe('tool-ssh')
    expect(ctx.tools.schemas().map(schema => schema.name)).toContain('ssh')
  }, 30_000)

  it('runs a remote command with BatchMode and without a password prompt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dshs-ssh-client-'))
    const clients = await fakeClient(directory)
    const ctx = await boot('danger-full-access', clients)
    const definition = ctx.tools.definitions().find((tool: ToolDefinition) => tool.name === 'ssh')
    expect(definition?.presentCall?.({
      action: 'exec', command: 'uname', justification: 'check the kernel',
    })).toMatchObject({ card: 'terminal', title: 'uname' })
    expect(definition?.presentCall?.({ action: 'exec', justification: 'check the kernel' })).toMatchObject({ card: 'terminal', title: 'ssh' })
    expect(definition?.presentCall?.({ action: 'list', justification: 'list home' })).toMatchObject({ card: 'generic', kind: 'read' })
    expect(definition?.presentCall?.({ action: 'forward', justification: 'open a port' })).toMatchObject({ card: 'generic', kind: 'other' })
    const noHost = await call(ctx, { action: 'exec', command: 'uname', justification: 'check the kernel' })
    expect(noHost.isError).toBe(true)
    const noListHost = await call(ctx, { action: 'list', justification: 'list the home directory' })
    expect(noListHost.isError).toBe(true)
    const bareList = await call(ctx, { action: 'list', destination: 'example', justification: 'list the home directory' })
    expect(bareList.isError).toBe(false)
    const missing = await call(ctx, { action: 'exec', destination: 'example', justification: 'check the kernel' })
    expect(missing.isError).toBe(true)
    const secret = await call(ctx, { action: 'exec', destination: 'example', command: 'uname', justification: 'password=no' })
    expect(secret.isError).toBe(true)
    const session = Session.create(SessionId('ssh-session'))
    const withAgent = await executeToolFixture(ctx, {
      signal: new AbortController().signal,
      callId: ToolCallId('ssh-agent'),
      name: 'ssh',
      arguments: { action: 'exec', destination: 'example', command: 'true', justification: 'run as the session' },
      agent: { session } as Agent,
    })
    expect(withAgent.isError).toBe(false)
    const blank = await call(ctx, { action: 'exec', destination: 'example', command: 'uname', justification: '   ' })
    expect(blank.isError).toBe(true)
    const badTimeout = await call(ctx, { action: 'list', destination: 'example', justification: 'list', timeoutMs: 0 })
    expect(badTimeout.isError).toBe(true)
    const result = await call(ctx, {
      action: 'exec', destination: 'example', command: 'uname -a', justification: 'check the kernel',
      port: 22, identityFile: '/tmp/id_ed25519',
    })
    expect(result.isError).toBe(false)
    expect(JSON.parse(textOf(result))).toMatchObject({ action: 'exec', destination: 'example', stdout: 'remote-ok\n', exitCode: 0 })
    const log = await readFile(clients.log, 'utf8')
    expect(log).toContain('BatchMode=yes')
    expect(log).toContain('PreferredAuthentications=publickey')
    expect(log).not.toContain('password')
    await rm(directory, { recursive: true, force: true })
  }, 30_000)

  it('copies a file with sftp and refuses private key text', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dshs-ssh-sftp-'))
    const clients = await fakeClient(directory)
    const ctx = await boot('danger-full-access', clients)
    const incomplete = await call(ctx, { action: 'upload', destination: 'example', justification: 'missing paths' })
    expect(incomplete.isError).toBe(true)
    const missingDownload = await call(ctx, { action: 'download', destination: 'example', justification: 'missing paths' })
    expect(missingDownload.isError).toBe(true)
    expect(incomplete.isError).toBe(true)
    const uploaded = await call(ctx, {
      action: 'upload', destination: 'alice@example.com', localPath: '/tmp/notes.txt', remotePath: 'notes.txt',
      justification: 'upload the notes', port: 22,
    })
    expect(uploaded.isError).toBe(false)
    const log = await readFile(clients.log, 'utf8')
    expect(log).toContain('BATCH put /tmp/notes.txt notes.txt')
    const listed = await call(ctx, {
      action: 'list', destination: 'example', remotePath: 'notes.txt', justification: 'list one file',
    })
    expect(listed.isError).toBe(false)
    const downloaded = await call(ctx, {
      action: 'download', destination: 'example', remotePath: 'notes.txt', localPath: '/tmp/notes.txt', justification: 'download the notes',
    })
    expect(downloaded.isError).toBe(false)
    expect(await readFile(clients.log, 'utf8')).toContain('BATCH get notes.txt /tmp/notes.txt')
    const rejected = await call(ctx, {
      action: 'exec', destination: 'example', command: 'echo password=secret', justification: 'do not do this',
    })
    expect(rejected.isError).toBe(true)
    expect(textOf(rejected)).toContain('private key or password')
    await rm(directory, { recursive: true, force: true })
  }, 30_000)

  it('opens a loopback forward and stops it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dshs-ssh-forward-'))
    const clients = await fakeClient(directory)
    const ctx = await boot('danger-full-access', clients)
    const noForwardHost = await call(ctx, { action: 'forward', localPort: 9, remoteHost: '127.0.0.1', remotePort: 80, justification: 'missing destination' })
    expect(noForwardHost.isError).toBe(true)
    const noLocal = await call(ctx, { action: 'forward', destination: 'example', remoteHost: '127.0.0.1', remotePort: 80, justification: 'missing local port' })
    expect(noLocal.isError).toBe(true)
    const noRemoteHost = await call(ctx, { action: 'forward', destination: 'example', localPort: 9, remotePort: 80, justification: 'missing remote host' })
    expect(noRemoteHost.isError).toBe(true)
    const noRemotePort = await call(ctx, { action: 'forward', destination: 'example', localPort: 9, remoteHost: '127.0.0.1', justification: 'missing remote port' })
    expect(noRemotePort.isError).toBe(true)
    const noStopPort = await call(ctx, { action: 'forward_stop', justification: 'missing port' })
    expect(noStopPort.isError).toBe(true)
    const opened = await call(ctx, {
      action: 'forward', destination: 'example', localPort: 0, remoteHost: '127.0.0.1', remotePort: 80,
      justification: 'reach the remote service',
    })
    expect(opened.isError).toBe(true)
    const port = 18765 + (process.pid % 1000)
    const started = await call(ctx, {
      action: 'forward', destination: 'example', localPort: port, remoteHost: '127.0.0.1', remotePort: 80,
      justification: 'reach the remote service',
    })
    expect(started.isError, textOf(started)).toBe(false)
    expect(JSON.parse(textOf(started))).toMatchObject({ action: 'forward', localPort: port })
    const duplicate = await call(ctx, {
      action: 'forward', destination: 'example', localPort: port, remoteHost: '127.0.0.1', remotePort: 80,
      justification: 'reach the remote service',
    })
    expect(duplicate.isError).toBe(true)
    expect(textOf(duplicate)).toContain('already forwarded')
    const stopped = await call(ctx, { action: 'forward_stop', localPort: port, justification: 'close the forward' })
    expect(stopped.isError).toBe(false)
    const missing = await call(ctx, { action: 'forward_stop', localPort: port, justification: 'close it again' })
    expect(missing.isError).toBe(true)
    expect(textOf(missing)).toContain('no forward')
    const identity = join(directory, 'id_ed25519')
    await writeFile(identity, 'not a key file\n')
    const loud = await call(ctx, {
      action: 'forward', destination: 'exit-now', localPort: port, remoteHost: '127.0.0.1', remotePort: 9,
      justification: 'this forward should fail', identityFile: identity, port: 22,
    })
    expect(textOf(loud)).toContain('refused')
    const quiet = await call(ctx, {
      action: 'forward', destination: 'exit-quiet', localPort: port, remoteHost: '127.0.0.1', remotePort: 9,
      justification: 'this forward should fail quietly',
    })
    expect(quiet.isError).toBe(true)
    const hung = await call(ctx, {
      action: 'forward', destination: 'sleep', localPort: port, remoteHost: '127.0.0.1', remotePort: 9,
      justification: 'this forward never listens', timeoutMs: 80,
    })
    expect(hung.isError).toBe(true)
    const controller = new AbortController()
    const aborting = executeToolFixture(ctx, {
      signal: controller.signal,
      callId: ToolCallId('abort-forward'),
      name: 'ssh',
      arguments: {
        action: 'forward', destination: 'sleep', localPort: port + 1, remoteHost: '127.0.0.1', remotePort: 9,
        justification: 'abort this forward',
      },
    })
    setTimeout(() => { controller.abort(new Error('stop forward')) }, 40)
    await expect(aborting).resolves.toMatchObject({ isError: true })
    const kept = await call(ctx, {
      action: 'forward', destination: 'example', localPort: port, remoteHost: '127.0.0.1', remotePort: 80,
      justification: 'leave this forward for disposal',
    })
    expect(kept.isError, textOf(kept)).toBe(false)
    await rm(directory, { recursive: true, force: true })
  }, 30_000)

  it('fails closed when approval cannot widen a read-only session', async () => {
    const ctx = await boot('read-only')
    const result = await call(ctx, { action: 'list', destination: 'example', justification: 'look around' })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toMatch(/approval|agent/i)
  }, 30_000)
})
