---
description: "Resolution of this edition's DeepSeek Harness home and agent configuration root, plus user-data paths, pnpm isolation, tilde expansion, and stable watch paths."
kind: "package-library"
---

# @deepseek-ai/dsh-home-paths

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-home-paths` lets package authors resolve this edition's DeepSeek Harness data root and agent configuration root. An explicit path wins over the edition-specific environment variable, which wins over the default under the operating-system home; blank environment values are ignored. Its public helpers can render a root without revealing an absolute machine path, expand only bare or current-user tilde forms, canonicalize watch targets whose final components do not yet exist, and keep pnpm state under the edition home. Use it as a direct library dependency, not through `cordis.yml`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Use these helpers wherever a package must agree with the rest of the harness about where user data lives: resolve the home once, then derive every child path from it.

### Resolving the home

```ts
import { resolveDshHome, dshHomePath, dshCachePath } from '@deepseek-ai/dsh-home-paths'

const home = resolveDshHome()                // configured path, else $DSHS_HOME, else ~/.dshs
const settings = dshHomePath('settings')     // join one child onto the resolved home
const cache = dshCachePath('models')         // $DSHS_HOME/cache/models, default ~/.dshs/cache/models
```

An explicit configured path has the highest precedence, then `$DSHS_HOME`, then the default `~/.dshs`. An empty or whitespace-only `$DSHS_HOME` is treated as unset, so a blank override never resolves the home to the current working directory. `$DSH_HOME` is not read, so an official `dsh` install that exports it keeps its own home.

`dshCachePath(...segments)` derives paths from the resolved home's `cache` directory. With no segments it returns the cache directory itself. Pass an initial options object, `dshCachePath({ dshHome: home }, ...segments)`, to use an explicit configured home with the same precedence and tilde expansion. It returns an absolute path without creating directories.

### Resolving the agents root

```ts
import { resolveAgentsHome, agentsHomeDisplay, pnpmEnvironment } from '@deepseek-ai/dsh-home-paths'

const agents = resolveAgentsHome()   // configured path, else $DSHS_AGENTS_HOME, else ~/.dshs/agents
agentsHomeDisplay(agents)            // ~/.dshs/agents, or $DSHS_AGENTS_HOME for any configured root
const env = pnpmEnvironment()        // pnpm and npm roots under $DSHS_HOME
```

`resolveAgentsHome` applies the same precedence, blank-value handling, and tilde expansion as `resolveDshHome`. The default is `$DSHS_HOME/agents`, so this edition does not read official `$DSH_AGENTS_HOME` or `~/.agents` data. `dsh-agent-instructions` reads its user-global `AGENTS.md`, and `dsh-skill-filesystem` scans its `skills/` directory.

`pnpmEnvironment` overrides npm/pnpm store, cache, state, global, and user-config paths with children of `$DSHS_HOME/pnpm` and `$DSHS_HOME/cache/pnpm`. Package-management credentials and downloads therefore do not enter official dsh or account-wide pnpm state.

### Displaying a home

For user-facing paths, render a root symbolically rather than as a machine path: the default harness home displays as `~/.dshs`, any configured harness home as `$DSHS_HOME`, the default agents root as `~/.dshs/agents`, and any configured agents root as `$DSHS_AGENTS_HOME`. Neither display form leaks an absolute machine path.

### Expanding user paths

`expandHomePath` expands a leading `~`, `~/`, or `~\` against the operating-system home and leaves everything else untouched — non-tilde paths and named-user forms such as `~alice/...` pass through unchanged.

### Canonicalizing watch paths

`canonicalizeWatchPath` gives a native filesystem watcher one canonical spelling of its target: the deepest existing ancestor is resolved through `realpath` and any missing suffix is restored, so a file or directory can be watched before it is created. This prevents Windows from treating a regular-file ancestor as ordinary absence, and prevents 8.3 short-name aliases from mixing with the long paths the native watcher backend emits.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package is built on one principle: all edition-owned state lives below `$DSHS_HOME`. `resolveRoot` and `rootDisplay` own the precedence and display rules for both data roots, so neither can drift from the other.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Home and agents resolution, pnpm environment, path joining, display, tilde expansion, and watch-path canonicalization |

### Resolution rules

`resolveDshHome` reads the explicit override, then `$DSHS_HOME`, then falls back to the operating-system home joined with `.dshs`. It does not read `$DSH_HOME`. `resolveAgentsHome` reads the same three levels for `$DSHS_AGENTS_HOME` and `~/.dshs/agents`; it does not read `$DSH_AGENTS_HOME`. The chosen value is tilde-expanded and normalized to an absolute path; `dshHomePath` joins child segments with Node's platform path rules. `dshHomeDisplay` and `agentsHomeDisplay` compare the resolved path against the default root and return the symbolic label, so a configured root never leaks its absolute path.

### Canonicalization mechanics

`canonicalizeWatchPath` walks up from the target until it finds an existing ancestor, resolves it with `realpath`, proves it is an enumerable directory, and restores the missing suffix. Errors other than absence propagate, and a missing-suffix ancestor that is not a directory is rejected.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when you need the launcher or the consumers that depend on a single home root.

- [Boot package](../../boot/app-boot/README.md) — the launcher that resolves the home before any plugin mounts.
- [Shell environment](../../shell/shell-env/README.md) — how `DSHS_HOME` reaches model shell calls.
- [Anonymous user id](../../identity/anonymous-user-id/README.md) — a stored identity file under the resolved home.

-----

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the helpers are not the right tool. They are current package constraints, not a task backlog.

- **Expansion is deliberately narrow** — only bare `~`, `~/...`, and `~\...` use the current operating-system home; named-user forms such as `~alice/...`, environment variables, and shell expressions remain unchanged.
- **Canonicalization reads but never mutates** — `canonicalizeWatchPath` performs `realpath` probes and propagates errors other than absence; callers still own directory creation, permissions, and trust policy for the resulting path.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
