---
description: "Enable experimental custom plugin indexes from the plugin manager."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-plugin-market-bundle

English | [中文](README.zh.md)

## Summary

This optional bundle no longer inserts plugin rows. The web and desktop profiles mount the Host [`pluginMarket`](../../boot/plugin-market/README.md) service and the Web [Discover tab](../../client/ui-plugin-market/README.md) themselves, with a default community index. Enabling this bundle adds no second copy of those rows.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Open **Plugins** in the Web sidebar. **Discover** is already present on a fresh web or desktop profile. It lists the default community index and installs a chosen bundle only after confirmation. Switching this bundle on or off does not add or remove that tab.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

The static `cordis.patch.yml` is an empty patch list. The web-app bundle inserts the `plugin-market` service row and the `ui-plugin-market` browser row, and its config names the default index URL. The Creator preset keeps its `tool-plugin-market` row; that plugin registers `plugin_market` only while `pluginMarket` is mounted.

</details>

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the `pluginMarket` service: with the bundle switched on, the Creator preset gains the read-only `plugin_market` tool documented in [`dsh-plugin-market`](../../boot/plugin-market/README.md#model-experience).

#### KV Cache effect

The web profile mounts `pluginMarket`, so Creator sessions include the `plugin_market` tool whether or not this bundle is enabled. Enabling or disabling this empty bundle does not change that schema.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The default index is a third-party community catalog, not an official DeepSeek registry. Discover still installs nothing until the user confirms.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer details — click to expand</summary>

None.

</details>
