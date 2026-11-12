---
description: "从插件管理页启用实验性的自定义插件索引。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-plugin-market-bundle

[English](README.md) | 中文

## 概述

此可选组合包不再插入插件行。Web 与 Desktop profile 自行挂载 Host 的 [`pluginMarket`](../../boot/plugin-market/README.zh.md) 服务和 Web 的[发现标签页](../../client/ui-plugin-market/README.zh.md)，并带有一个默认的社区索引。启用此组合包不会再插入这些行的第二份副本。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

打开 Web 侧栏中的**插件**。全新的 web 或 desktop profile 已经带有**发现**。它列出默认的社区索引，并且只有在确认之后才会安装选中的组合包。打开或关闭此组合包不会添加或移除该标签页。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者信息 — 点击展开</summary>

静态 `cordis.patch.yml` 是空的补丁列表。web-app 组合包插入 `plugin-market` 服务行和 `ui-plugin-market` 浏览器行，并在配置中写明默认索引 URL。Creator 预设保留其 `tool-plugin-market` 行；该插件只在 `pluginMarket` 已挂载时注册 `plugin_market`。

</details>

-----

<a id="model-experience"></a>
## 模型体验

Web profile 会挂载 `pluginMarket`，因此无论是否启用此组合包，Creator 会话都包含只读的 `plugin_market` 工具，其说明见 [`dsh-plugin-market`](../../boot/plugin-market/README.zh.md#model-experience)。

#### KV Cache 影响

启用或禁用这个空组合包不会改变该工具 schema。Web profile 挂载 `pluginMarket` 时，Creator 会话的请求前缀已经包含它。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 默认索引是第三方社区目录，不是 DeepSeek 官方注册表。发现页在用户确认之前不会安装任何内容。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者信息 — 点击展开</summary>

无。

</details>
