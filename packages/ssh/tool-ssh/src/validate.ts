/**
 * Argument checks for the OpenSSH tool. Paths and destinations stay single
 * argv tokens so the local process never invokes a shell.
 * @module @deepseek-ai/dsh-tool-ssh/validate
 */

import { ToolArgsError } from '@deepseek-ai/dsh-tools'
import { HarnessError } from '@deepseek-ai/dsh-llm'

/** Stable failure classes for SSH operations that did not produce a remote result. */
export const SSH_TOOL_ERROR_CODES = [
  'SSH_CLIENT_MISSING',
  'SSH_FAILED',
  'SSH_FORWARD_FAILED',
  'SSH_FORWARD_UNKNOWN',
] as const

/** One code from {@link SSH_TOOL_ERROR_CODES}. */
export type SshToolErrorCode = typeof SSH_TOOL_ERROR_CODES[number]

/** A local SSH client failure. Remote non-zero exits are results, not this error. */
export class SshToolError extends HarnessError {
  override readonly code: SshToolErrorCode

  /**
   * @param message - model-facing explanation.
   * @param code - failure class consumers route on.
   * @param options - chained cause, when the client spawn failed.
   */
  constructor(message: string, code: SshToolErrorCode, options?: ErrorOptions) {
    super(message, code, options)
    this.name = 'SshToolError'
    this.code = code
  }
}

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g
const PRIVATE_KEY_START = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/
const PASSWORD_MATERIAL = /sshpass|SSH_ASKPASS|password\s*[:=]/i

/**
 * Replace PEM private-key blocks so command output cannot echo key material.
 * @param text - process output or another string that may contain a key.
 * @returns the string with each private-key block replaced.
 */
export function redactSecrets(text: string): string {
  return text.replace(PRIVATE_KEY_BLOCK, '[redacted private key]')
}

/**
 * Report whether text contains a PEM private key or a password assignment.
 * @param text - candidate command, path, or output.
 * @returns true when the text must not be sent, stored in a result, or treated as a path.
 */
export function containsSecretMaterial(text: string): boolean {
  return PRIVATE_KEY_START.test(text) || PASSWORD_MATERIAL.test(text)
}

/**
 * Reject private-key or password text before it is passed to OpenSSH or returned.
 * @param text - value the model supplied.
 * @param label - argument name named in the error.
 */
export function assertNoSecretMaterial(text: string, label: string): void {
  if (containsSecretMaterial(text)) {
    throw new ToolArgsError([`${label} must not contain a private key or password`])
  }
}

/**
 * Accept an OpenSSH destination: a config alias, hostname, or `user@host`.
 * @param value - model-supplied destination.
 * @returns the same destination when it is safe to pass as one argv element.
 */
export function assertDestination(value: string): string {
  assertNoSecretMaterial(value, 'destination')
  if (value.length === 0 || value !== value.trim()) {
    throw new ToolArgsError(['destination must be a non-empty OpenSSH host or user@host'])
  }
  const at = value.lastIndexOf('@')
  const user = at === -1 ? undefined : value.slice(0, at)
  const host = at === -1 ? value : value.slice(at + 1)
  if (user !== undefined && !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,63}$/.test(user)) {
    throw new ToolArgsError(['destination user must be a single token without spaces'])
  }
  const named = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,252}[A-Za-z0-9])?$/.test(host)
  const ipv6 = /^\[[0-9A-Fa-f:.]+\]$/.test(host)
  if (!named && !ipv6) throw new ToolArgsError(['destination host must be a hostname, alias, or bracketed IPv6 address'])
  return value
}

/**
 * Accept a TCP port.
 * @param value - model-supplied port.
 * @param label - argument name named in the error.
 * @returns the port as an integer.
 */
export function assertPort(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ToolArgsError([`${label} must be an integer from 1 to 65535`])
  }
  return value
}

/**
 * Accept one local or remote path as a single sftp token.
 * @param value - model-supplied path.
 * @param label - argument name named in the error.
 * @returns the path when it cannot break out of the sftp batch file.
 */
export function assertTransferPath(value: string, label: string): string {
  assertNoSecretMaterial(value, label)
  if (value.length === 0 || value.length > 4096 || value.startsWith('-') || /[\0-\x1f "'\\$*?`;|&<>]/.test(value)) {
    throw new ToolArgsError([`${label} must be one path without spaces, quotes, or shell metacharacters`])
  }
  return value
}

/**
 * Accept the host a port forward connects to from the remote side.
 * @param value - model-supplied remote host.
 * @returns the host when it is a single token.
 */
export function assertForwardHost(value: string): string {
  assertNoSecretMaterial(value, 'remoteHost')
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,252}[A-Za-z0-9])?$/.test(value)) {
    throw new ToolArgsError(['remoteHost must be a hostname or IPv4 address on the remote side'])
  }
  return value
}
