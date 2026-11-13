# Agent Note: Edition agents root joins the user-global instruction chain

Status: implemented

English | [中文](2026-10-05-shared-agents-root-instructions.zh.md)

## Problem

DSH Special loads one user-global instruction file, `$DSHS_HOME/AGENTS.md`. The edition agent configuration root is `$DSHS_AGENTS_HOME` or `~/.dshs/agents`, which `dsh-skill-filesystem` also scans for skills. Official `$DSH_AGENTS_HOME` and `~/.agents` remain outside this edition, so an official dsh installation cannot inject instructions or skills into a special-edition session.

## Decision

The user-global instruction scope has two ordered roots: `$DSHS_HOME/AGENTS.md` first, then `<agentsHome>/AGENTS.md`. The instruction loader resolves the harness home from `$DSHS_HOME` or `~/.dshs`, and `agentsHome` from `$DSHS_AGENTS_HOME` or `~/.dshs/agents`. `resolveAgentsHome` and `agentsHomeDisplay` in `dsh-home-paths` own that resolution for both `dsh-agent-instructions` and `dsh-skill-filesystem`, so the edition agent root has one resolver whose tilde expansion and blank-environment handling match the harness home.

The two files are candidates of one candidate group. They deduplicate by trimmed content, so identical copies render once from the harness home, and an unobservable candidate preserves the group's last-good state. A duplicate of budget-retained content keeps being reconciled, so deleting or changing the retained candidate promotes it; a byte-budget omission leaves that candidate and its content duplicates unprobed. The harness-home file keeps the `user-global` scope key that earlier sessions recorded; the edition agents file carries `agents-global`, and reconciliation probes both roots on resume, so an external edit, a removal, or a newly created file appears as a change notice instead of a new baseline.

A user-global scope directory is an internal reconciliation key, so it stays out of model-visible prose: a global delta states `These user-global instructions apply to all work.` instead of naming a scope directory, and a project path whose first component would collide with one renders with a leading `.` so it keeps its own scope.

`USER_GLOBAL_DIRECTORIES` fixes the root order, and discovery, baseline reconciliation, and deduplication all iterate it. The harness home therefore decides content duplicates and keeps its position in the baseline, while distinct content from the edition agents root follows it.

## Alternatives considered

**Replace the harness-home file with the agents root.** The harness home owns edition-specific configuration, and its `AGENTS.md` is the documented, tested, and rendered user-global file. Removing it would drop an edition-only layer, and sessions that recorded `user-global` state would lose their referent.

**Load the agents root only when the harness-home file is absent.** The two files then alternate as the session-visible user-global file, which makes an edition-specific file silently suppress the agents file instead of composing with it.

**Load the agents file as a second candidate name in the harness home.** `instructionFileCandidates` names files within one directory; the two roots are different directories, so the option cannot express this chain without redefining candidate semantics.

**Rely on path identity instead of content for the duplicate case.** A deployment may symlink `$DSHS_HOME/AGENTS.md` to `~/.dshs/agents/AGENTS.md`, which is two paths for one file. Path identity drops neither, so the same text would render twice under two display labels.

## Consequences

- Edition agent instructions load without a copy or symlink, and the symlinked layout still renders once, from the harness home.
- A session that started before this change receives one transition when the agents file exists with content that differs from the harness-home file.
- `dsh-agent-instructions` exposes no `dshHome` or `agentsHome` config field; its two roots are process policy. `dsh-skill-filesystem` retains its explicit home fields, which select that provider's own skill roots.
- The two user-global files share one fate on probe failure: the group preserves its last-good state together, because one digest decides which member renders.
- `packages/context/agent-instructions/tests/agent-instructions.spec.ts` pins the two-root order, content deduplication, duplicate promotion after the retained candidate changes or disappears, the global delta wording, the `replace` and `remove` transitions, `$DSHS_AGENTS_HOME` resolution, the `~/.dshs/agents` display label, and the escaped project directory name.
