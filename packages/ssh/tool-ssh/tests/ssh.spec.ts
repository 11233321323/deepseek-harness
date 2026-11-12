import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { localPortAccepts, runCaptured } from '../src/process.ts'
import {
  assertDestination, assertForwardHost, assertPort, assertTransferPath, redactSecrets,
} from '../src/validate.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('SSH argument checks', () => {
  it('accepts aliases, user@host, and bracketed IPv6', () => {
    expect(assertDestination('bastion')).toBe('bastion')
    expect(assertDestination('alice@example.com')).toBe('alice@example.com')
    expect(assertDestination('alice@[2001:db8::1]')).toBe('alice@[2001:db8::1]')
  })

  it('rejects shell metacharacters, secrets, and blank hosts', () => {
    expect(() => assertDestination('host;rm')).toThrow(/destination host/)
    expect(() => assertDestination('bad user@host')).toThrow(/destination user/)
    expect(() => assertDestination('')).toThrow(/non-empty/)
    expect(() => assertDestination(' host')).toThrow(/non-empty/)
    expect(() => assertDestination('-----BEGIN OPENSSH PRIVATE KEY-----')).toThrow(/private key or password/)
    expect(() => assertTransferPath('a b', 'remotePath')).toThrow(/one path/)
    expect(() => assertTransferPath('-rf', 'remotePath')).toThrow(/one path/)
    expect(() => assertPort(0, 'port')).toThrow(/1 to 65535/)
    expect(() => assertPort(1.5, 'port')).toThrow(/1 to 65535/)
    expect(assertPort(22, 'port')).toBe(22)
    expect(assertForwardHost('127.0.0.1')).toBe('127.0.0.1')
    expect(() => assertForwardHost('bad host')).toThrow(/remoteHost/)
  })

  it('redacts private key blocks and leaves ordinary text', () => {
    const key = '-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n-----END OPENSSH PRIVATE KEY-----'
    expect(redactSecrets(`before\n${key}\nafter`)).toBe('before\n[redacted private key]\nafter')
    expect(redactSecrets('no key')).toBe('no key')
  })
})

describe('local OpenSSH process', () => {
  it('captures stdout without a shell', async () => {
    const captured = await runCaptured({
      binary: process.execPath,
      args: ['-e', 'process.stdout.write("ok"); process.stderr.write("err")'],
      signal: new AbortController().signal,
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    })
    expect(captured).toMatchObject({ exitCode: 0, stdout: 'ok', truncated: false, timedOut: false })
  })

  it('redacts key material and marks a truncated stream', async () => {
    const script = 'process.stdout.write("-----BEGIN OPENSSH PRIVATE KEY-----\\nabc\\n-----END OPENSSH PRIVATE KEY-----"); setTimeout(() => { process.stdout.write("yyyy"); process.exit(0) }, 20)'
    const captured = await runCaptured({
      binary: process.execPath,
      args: ['-e', script],
      signal: new AbortController().signal,
      timeoutMs: 5_000,
      maxOutputBytes: 12,
    })
    expect(captured.stdout).not.toContain('PRIVATE KEY')
    expect(captured.truncated).toBe(true)
  })

  it('reports a directory as a failed spawn', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dshs-ssh-dir-'))
    roots.push(root)
    await expect(runCaptured({
      binary: root,
      args: [],
      signal: new AbortController().signal,
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    })).rejects.toMatchObject({ code: 'SSH_FAILED' })
  })

  it('reports a missing executable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dshs-ssh-missing-'))
    roots.push(root)
    await expect(runCaptured({
      binary: join(root, 'missing-ssh'),
      args: [],
      signal: new AbortController().signal,
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    })).rejects.toMatchObject({ code: 'SSH_CLIENT_MISSING' })
  })

  it('stops a running process when the call is aborted', async () => {
    const controller = new AbortController()
    const pending = runCaptured({
      binary: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      signal: controller.signal,
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    })
    setTimeout(() => { controller.abort() }, 30)
    const captured = await pending
    expect(captured.exitCode).not.toBe(0)
  })

  it('kills a process that exceeds its deadline', async () => {
    const captured = await runCaptured({
      binary: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      signal: new AbortController().signal,
      timeoutMs: 50,
      maxOutputBytes: 100,
    })
    expect(captured.timedOut).toBe(true)
    expect(captured.exitCode).not.toBe(0)
  })

  it('rejects when the call is already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new Error('stopped'))
    await expect(runCaptured({
      binary: process.execPath,
      args: ['-e', 'process.exit(0)'],
      signal: controller.signal,
      timeoutMs: 5_000,
      maxOutputBytes: 100,
    })).rejects.toThrow('stopped')
  })

  it('probes a loopback port and gives up when nothing listens', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('expected a tcp port')
    await expect(localPortAccepts(address.port, 1_000, new AbortController().signal)).resolves.toBe(true)
    server.close()
    await expect(localPortAccepts(address.port, 40, new AbortController().signal)).resolves.toBe(false)
    const aborted = new AbortController()
    aborted.abort()
    await expect(localPortAccepts(9, 1_000, aborted.signal)).resolves.toBe(false)
  })
})
