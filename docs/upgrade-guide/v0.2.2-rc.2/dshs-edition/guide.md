---
kind: upgrade-guide
description: "The command, home directory, and Web port of this edition no longer match official dsh."
---

# This edition uses dshs, ~/.dshs, and port 3180

English | [中文](guide.zh.md)

## Change

Official `dsh` keeps the `dsh` command, `$DSH_HOME` or `~/.dsh`, and Web port `3080`. This edition's command is `dshs`, its home is `$DSHS_HOME` or `~/.dshs`, and its Web UI listens on port `3180`. `$DSH_HOME` is not read. A fresh web or desktop profile includes Discover and the `ssh` tool.

## Migration

1. Run this checkout with `pnpm dshs web`, not `npx @deepseek-ai/dsh`. Do not install this package into the same global prefix as official `@deepseek-ai/dsh`.
2. Move any data you want this edition to keep from `~/.dsh` to `~/.dshs`, or set `DSHS_HOME` to a new directory. Leave `~/.dsh` for official `dsh`.
3. Open `http://127.0.0.1:3180`. Confirm `~/.dsh` and `~/.dshs` are different directories and that official `dsh` still prints port `3080`.
