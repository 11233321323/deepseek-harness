# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run beside official dsh

This repository is a special edition of DeepSeek Harness. It is meant to be installed next to official `dsh` without replacing the `dsh` command, `~/.dsh`, or port `3080`.

| | Official dsh | This edition |
|---|---|---|
| Command | `dsh` | `dshs` |
| npm bin | `dsh` from `@deepseek-ai/dsh` on the official registry | `dshs` from this checkout's `@deepseek-ai/dsh` package |
| Home | `~/.dsh`, or `$DSH_HOME` | `~/.dshs`, or `$DSHS_HOME` |
| Web UI | `http://127.0.0.1:3080` | `http://127.0.0.1:3180` |
| Desktop user data | Electron name derived from the official app | `dshs` under the OS app-data directory |
| Desktop command | `/usr/local/bin/dsh` | `/usr/local/bin/dshs` |
| URL scheme | `dsh://` | `dshs://` |

`$DSH_HOME` is not read. A shell that exports it for official `dsh` does not point this edition at that directory. Profiles, sessions, credentials, and installed plugins live under the edition home.

Do not `npm install -g` this package into the same prefix as official `@deepseek-ai/dsh`. That replaces the package even though the new bin name is `dshs`. From a checkout, `pnpm dshs` runs this edition and leaves a globally installed `dsh` in place. `pnpm dsh` in this checkout is the same process; it is not the official binary.

### Run from source

Install Node.js 24.9 or newer, then:

```sh
git clone https://github.com/11233321323/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dshs web
```

The command starts the Web UI at `http://127.0.0.1:3180` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

`pnpm run build` prepares the repository artifacts. `pnpm dshs web` uses those built artifacts without rebuilding.

Confirm the two installs do not share state:

```sh
dsh web --no-open
pnpm dshs web --no-open
printf '%s\n' "$DSH_HOME" "$DSHS_HOME"
ls -d ~/.dsh ~/.dshs
```

Official `dsh web --no-open` prints a URL on port 3080 and uses `~/.dsh` when `DSH_HOME` is unset. `pnpm dshs web --no-open` prints `dshs web: http://127.0.0.1:3180/...`.

Official `dsh` keeps using `~/.dsh`. This edition creates `~/.dshs` and does not write `~/.dsh`.

### Plugin marketplace

A fresh web or desktop profile includes **Plugins → Discover**. The default index is the public community catalog `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` (the same document published by [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) and described at [dshmarket.com](https://dshmarket.com/)). It is not an official DeepSeek registry. Browse and search there, then install or remove a bundle from the confirmation dialog. Nothing from the index runs until you install it, and install still follows the profile's plugin manager and approval rules. Remove the URL under Discover's index sources to stop using that catalog.

### SSH tools

The standard, ptc, and cordis presets, and the headless profile, include an `ssh` tool. It uses the local OpenSSH client and your existing keys or agent. It can run a remote command, list a directory, upload or download a file, and open a local port forward with `forward` / `forward_stop`. It does not ask for a password. Hosts must already be in `known_hosts`. Each call needs approval unless the session is already in full-access mode. Do not paste private keys or passwords into the chat.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/4MrtZUhpxg">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal, and `make help` lists the matching Make targets for Web and Desktop; the guide's application commands section owns the full table.

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
