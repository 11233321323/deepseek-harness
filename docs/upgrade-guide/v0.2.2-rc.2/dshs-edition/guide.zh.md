---
kind: upgrade-guide
description: "本版本的命令、主目录和 Web 端口不再与官方 dsh 相同。"
---

# 本版本使用 dshs、~/.dshs 和端口 3180

[English](guide.md) | 中文

## 变更

官方 `dsh` 仍使用 `dsh` 命令、`$DSH_HOME` 或 `~/.dsh`，以及 Web 端口 `3080`。本版本的命令是 `dshs`，主目录是 `$DSHS_HOME` 或 `~/.dshs`，Web UI 监听端口 `3180`。本版本不读取 `$DSH_HOME`。全新的 web 或 desktop profile 包含发现页，但不包含自定义 SSH 工具。需要 SSH 时，请安装社区目录插件 `@lemoncat7/dsh-ssh`。

## 迁移

1. 用 `pnpm dshs web` 运行本检出，而不是 `npx @deepseek-ai/dsh`。不要把这个包装进与官方 `@deepseek-ai/dsh` 相同的全局前缀。
2. 把希望本版本保留的数据从 `~/.dsh` 移到 `~/.dshs`，或把 `DSHS_HOME` 设为一个新目录。把 `~/.dsh` 留给官方 `dsh`。
3. 打开 `http://127.0.0.1:3180`。确认 `~/.dsh` 和 `~/.dshs` 是不同的目录，并且官方 `dsh` 仍打印端口 `3080`。
4. 要使用 SSH，打开**插件 → 发现**并通过确认对话框安装 `@lemoncat7/dsh-ssh`，或运行 `dshs plugin --profile web add @lemoncat7/dsh-ssh@latest`。该插件由第三方维护，仍受插件管理器兼容性与审批规则约束。
