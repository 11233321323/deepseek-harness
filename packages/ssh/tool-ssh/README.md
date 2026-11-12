---
description: "Model-facing OpenSSH tool for remote commands, sftp copies, and local port forwards."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-ssh

English | [中文](README.zh.md)

## Summary

`dsh-tool-ssh` registers the `ssh` tool. It runs one remote command, lists or copies files with sftp, and opens a loopback port forward through the local OpenSSH client. Authentication is the user's existing keys and agent. The web standard, ptc, and cordis presets and the headless profile mount it.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Load it beside `dsh-sandbox-policy` and `dsh-tools`. Every call asks for `danger-full-access` unless the session is already in that mode. A rejected approval runs nothing.

| Field | Default | Meaning |
|---|---|---|
| `sshPath` | `ssh` | Local `ssh` executable |
| `sftpPath` | `sftp` | Local `sftp` executable |
| `timeoutMs` | `30000` | Deadline for exec, list, upload, and download |
| `maxOutputBytes` | `1048576` | Retained bytes of each stream |

The generated [tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ssh) is the argument schema. Hosts must already be in `known_hosts`. The client is started with `BatchMode`, public-key authentication only, and no password prompts.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

The tool spawns `ssh` or `sftp` with `shell: false`. sftp commands are written to a private batch file. Port forwards bind `127.0.0.1` and stay in the plugin until `forward_stop` or plugin disposal. PEM private-key blocks are removed from captured output. Commands and paths that contain a private key or a password assignment are rejected before spawn.

</details>

-----

<a id="model-experience"></a>
## Model Experience

### Tool schema

#### What the model sees

The model sees the `ssh` tool documented in the [tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ssh). `action` is `exec`, `list`, `upload`, `download`, `forward`, or `forward_stop`. `justification` is required. Passwords and private-key text are not parameters.

#### Token effect

One fixed schema on every request where the tool is visible.

#### KV Cache effect

Prefix-stable while the definition stays mounted. Adding or removing the preset row changes later request prefixes.

### Tool-call history and result

#### What the model sees

A successful call returns one JSON object with `action`, the destination when one was used, and either the redacted streams plus `exitCode` or the forward's `localPort`. A non-zero remote exit is that JSON, not a tool error. Rejected arguments, a missing OpenSSH client, a failed forward, and a denied approval are tool errors.

#### Token effect

Result size follows the retained stdout and stderr, capped by `maxOutputBytes`.

#### KV Cache effect

Results are ordinary tool results and do not change the cached tool schema.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Password authentication is not offered. The host must accept a key or the agent.
- Transfer paths cannot contain spaces or shell metacharacters.
- A private key the model already wrote into the tool call is stored with that call. The tool rejects the text before sending it and redacts key blocks in command output.
- Port forwards end when the profile process stops.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
