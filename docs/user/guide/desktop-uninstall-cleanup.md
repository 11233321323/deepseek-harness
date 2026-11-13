# Uninstall DSH Desktop

English | [中文](desktop-uninstall-cleanup.zh.md)

Use this guide to uninstall DSH Special Desktop on macOS or Windows. Local data cleanup is optional.

## 1. Uninstall the app

Finish any commands using Desktop's bundled CLI. If you installed the `dshs` command through Desktop, first select **Manage dshs Command… → Remove** in the application menu. This removes Desktop's command registration without uninstalling independent CLI programs.

Quit DSH Special, then uninstall it using your platform's procedure:

- **macOS:** Delete the app from Applications in Finder.
- **Windows:** Uninstall it through Settings → Apps → Installed apps on Windows 11, or Control Panel → Programs → Programs and Features.

## 2. Clean up local data

This step is optional. If you want to clean up local data, select the script for your platform below, then paste and run it in Terminal on macOS or PowerShell on Windows.

The scripts permanently delete the current user's default Harness home and the Desktop data paths listed below, including sessions, credentials, settings, plugins, caches, and shared CLI state. If you configured `DSHS_HOME`, inspect that directory separately before deleting it; the scripts still delete the default `~/.dshs`. Isolated development and test data directories are outside this cleanup scope.

On Windows, the uninstaller normally removes the two application-data directories listed in the script but retains the Harness home. The script also handles those directories if uninstallation left files behind or retained app data.

::: code-group

```sh [macOS]
sh -c '
rm -rf -- \
  "$HOME/.dshs" \
  "$HOME/Library/Application Support/dshs" \
  "$HOME/Library/Preferences/com.deepseek.dshs.plist" \
  "$HOME/Library/Preferences/ByHost"/com.deepseek.dshs.ShipIt.*.plist \
  "$HOME/Library/Caches/dshs-updater" \
  "$HOME/Library/Caches/com.deepseek.dshs" \
  "$HOME/Library/Caches/com.deepseek.dshs.ShipIt" \
  "$HOME/Library/HTTPStorages/com.deepseek.dshs" \
  "$(getconf DARWIN_USER_CACHE_DIR)/com.deepseek.dshs" \
  "$(getconf DARWIN_USER_CACHE_DIR)/com.deepseek.dshs.helper"
'
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
@(
    (Join-Path $env:USERPROFILE '.dshs'),
    (Join-Path $env:APPDATA 'dshs'),
    (Join-Path $env:LOCALAPPDATA 'dshs-updater')
) | ForEach-Object {
    if (Test-Path -LiteralPath $_) {
        Remove-Item -LiteralPath $_ -Recurse -Force
    }
}
```

:::

## 3. Verify cleanup

If you ran a cleanup script, confirm before reinstalling that the paths listed in it no longer exist. If the script reports an error, resolve it, rerun the script, and check all listed paths again. The Windows script stops at the first error, so later paths may remain.
