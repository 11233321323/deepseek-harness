---
description: "面向模型的 OpenSSH 工具：远端命令、sftp 拷贝与本地端口转发。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-ssh

[English](README.md) | 中文

## 摘要

`dsh-tool-ssh` 注册 `ssh` 工具。它通过本机 OpenSSH 客户端运行一条远端命令、用 sftp 列出或拷贝文件，并打开一个环回端口转发。认证使用用户已有的密钥和 agent。Web 的 standard、ptc 和 cordis 预设以及 headless profile 会挂载它。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

把它和 `dsh-sandbox-policy`、`dsh-tools` 一起加载。除非会话已经处于 `danger-full-access`，每次调用都会请求该权限。审批被拒绝时不会执行任何操作。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `sshPath` | `ssh` | 本地 `ssh` 可执行文件 |
| `sftpPath` | `sftp` | 本地 `sftp` 可执行文件 |
| `timeoutMs` | `30000` | exec、list、upload 和 download 的时限 |
| `maxOutputBytes` | `1048576` | 每个流保留的字节数 |

参数 schema 见生成的[工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-ssh)。主机必须已经在 `known_hosts` 中。客户端以 `BatchMode`、仅公钥认证、并且不提示密码的方式启动。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者信息 — 点击展开</summary>

该工具以 `shell: false` 启动 `ssh` 或 `sftp`。sftp 命令写入一个私有批处理文件。端口转发绑定 `127.0.0.1`，并保留到 `forward_stop` 或插件释放。捕获的输出会去掉 PEM 私钥块。包含私钥或密码赋值的命令和路径会在启动前被拒绝。

</details>

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### 模型看到什么

模型看到[工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-ssh)中的 `ssh` 工具。`action` 为 `exec`、`list`、`upload`、`download`、`forward` 或 `forward_stop`。`justification` 是必填项。密码和私钥文本不是参数。

#### Token 影响

工具可见的每个请求上有一份固定 schema。

#### KV Cache 影响

定义保持挂载时，前缀稳定。增加或移除预设行会改变后续请求前缀。

### 工具调用历史与结果

#### 模型看到什么

成功的调用返回一个 JSON 对象，包含 `action`、使用过的 destination，以及脱敏后的流和 `exitCode`，或者转发的 `localPort`。远端非零退出是这份 JSON，不是工具错误。被拒绝的参数、缺失的 OpenSSH 客户端、失败的转发和被拒绝的审批是工具错误。

#### Token 影响

结果大小跟随保留的 stdout 和 stderr，并受 `maxOutputBytes` 限制。

#### KV Cache 影响

结果是普通工具结果，不改变缓存的工具 schema。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 不提供密码认证。主机必须接受密钥或 agent。
- 传输路径不能包含空格或 shell 元字符。
- 模型已经写进工具调用的私钥会随该调用保存。工具在发送前拒绝这段文本，并在命令输出中脱敏私钥块。
- profile 进程停止时，端口转发结束。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者信息 — 点击展开</summary>

无。

</details>
