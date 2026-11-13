# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 与官方 dsh 并排运行

本仓库是 DeepSeek Harness 的特别版。它可以安装在官方 `dsh` 旁边，而不替换 `dsh` 命令、`~/.dsh` 或端口 `3080`。

| | 官方 dsh | 本版本 |
|---|---|---|
| 命令 | `dsh` | `dshs` |
| npm bin | 官方 registry 上 `@deepseek-ai/dsh` 的 `dsh` | 本检出中 `@deepseek-ai/dsh` 包的 `dshs` |
| 主目录 | `~/.dsh`，或 `$DSH_HOME` | `~/.dshs`，或 `$DSHS_HOME` |
| Web UI | `http://127.0.0.1:3080` | `http://127.0.0.1:3180` |
| Desktop 用户数据 | 由官方应用的 Electron 名称决定 | 操作系统应用数据目录下的 `dshs` |
| Desktop 命令 | `/usr/local/bin/dsh` | `/usr/local/bin/dshs` |
| URL scheme | `dsh://` | `dshs://` |

本版本不读取 `$DSH_HOME`。为官方 `dsh` 导出该变量的 shell 不会把本版本指到那个目录。profile、会话、凭据和已安装插件都位于本版本的主目录下。

不要把这个包 `npm install -g` 到与官方 `@deepseek-ai/dsh` 相同的前缀。即使新的 bin 名称是 `dshs`，这仍会替换那个包。在检出目录中，`pnpm dshs` 运行本版本，并保留已全局安装的 `dsh`。本检出中的 `pnpm dsh` 是同一进程，不是官方二进制。

<a id="run-from-source"></a>

### 从源码运行

安装 Node.js 24.9 或更新版本，然后：

```sh
git clone https://github.com/11233321323/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dshs web
```

该命令默认会在 `http://127.0.0.1:3180` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

`pnpm run build` 会准备仓库产物。`pnpm dshs web` 会直接使用这些已构建产物，不会重新构建。

确认两个安装不共享状态：

```sh
dsh web --no-open
pnpm dshs web --no-open
printf '%s\n' "$DSH_HOME" "$DSHS_HOME"
ls -d ~/.dsh ~/.dshs
```

未设置 `DSH_HOME` 时，官方 `dsh web --no-open` 打印端口 3080 上的 URL，并使用 `~/.dsh`。`pnpm dshs web --no-open` 打印 `dshs web: http://127.0.0.1:3180/...`。

官方 `dsh` 继续使用 `~/.dsh`。本版本创建 `~/.dshs`，并且不写入 `~/.dsh`。

### 插件市场

全新的 web 或 desktop profile 包含**插件 → 发现**。默认索引是公开的社区目录 `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`（与 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 发布的文档相同，并在 [dshmarket.com](https://dshmarket.com/) 说明）。它不是 DeepSeek 官方注册表。在那里浏览和搜索，然后通过确认对话框安装或移除组合包。索引中的内容在你安装之前不会运行，安装仍遵循 profile 的插件管理器和审批规则。在发现页的索引源中删除该 URL，即可停止使用这个目录。

### SSH 支持

本版本不附带自定义 SSH 工具。要让 agent 使用 SSH，请安装社区目录中的 [`@lemoncat7/dsh-ssh`](https://awesome-dsh-plugin.com/p/lemoncat7/dsh-ssh/)（MIT）。它提供主机管理、浏览器终端、SFTP、端口转发与代理，以及会话级 AI SSH 访问。

在 Web UI 中打开**插件 → 发现**，选择 `@lemoncat7/dsh-ssh`，并确认正常的插件安装流程。在 shell 中可运行 `dshs plugin --profile web add @lemoncat7/dsh-ssh@latest`。社区目录由第三方维护；安装仍会执行插件管理器的确认、兼容性与审批规则。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群！扫描下方二维码填写入群问卷，小助手会定期发送入群邀请。

<table>
  <thead>
    <tr>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

`pnpm run dev:web` 会在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。完整表格见开发指南的「应用命令」一节。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
