import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppInfo, Packager } from 'app-builder-lib'
import { describe, expect, it } from 'vitest'
import {
  defaultAgentsHome,
  defaultDshHome,
  pnpmEnvironment,
  resolveAgentsHome,
  resolveDshHome,
} from '@deepseek-ai/dsh-home-paths'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'
import { resolveDesktopUserData } from '../src/paths.ts'

const UNSIGNED_WINDOWS = {
  DSH_DESKTOP_APP_ID: 'com.deepseek.dshs',
  DSH_DESKTOP_UNSIGNED: '1',
  DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN: 'https://policy.example.com',
  DSH_DESKTOP_MANDATORY_UPDATE_CONFIG: JSON.stringify({ allowedAuthOrigins: ['https://login.example.com'] }),
}

describe('DSH Special edition isolation', () => {
  it('keeps all default roots and Electron state distinct from official dsh', () => {
    const officialHome = join(homedir(), '.dsh')
    const officialAgents = join(homedir(), '.agents')
    expect(defaultDshHome()).not.toBe(officialHome)
    expect(defaultAgentsHome()).not.toBe(officialAgents)
    expect(defaultAgentsHome()).toBe(join(defaultDshHome(), 'agents'))
    expect(resolveDshHome(undefined, {
      DSH_HOME: officialHome,
      DSHS_HOME: join(homedir(), '.dshs'),
    })).toBe(join(homedir(), '.dshs'))
    expect(resolveAgentsHome(undefined, {
      DSH_AGENTS_HOME: officialAgents,
      DSH_HOME: officialHome,
    })).toBe(defaultAgentsHome())
    expect(resolveAgentsHome(undefined, {
      DSHS_AGENTS_HOME: join(homedir(), '.dshs', 'agents'),
    })).toBe(join(homedir(), '.dshs', 'agents'))
    expect(resolveDesktopUserData('/app-data')).toBe(join('/app-data', 'dshs'))
  })

  it('scopes package-manager credentials, caches, stores, and globals to the edition home', () => {
    const home = join('/data', '.dshs')
    expect(pnpmEnvironment(home, {
      HOME: '/home/person',
      NPM_CONFIG_USERCONFIG: '/home/person/.npmrc',
    })).toMatchObject({
      HOME: '/home/person',
      PNPM_HOME: join(home, 'pnpm', 'bin'),
      NPM_CONFIG_STORE_DIR: join(home, 'cache', 'pnpm', 'store'),
      NPM_CONFIG_CACHE_DIR: join(home, 'cache', 'pnpm'),
      NPM_CONFIG_STATE_DIR: join(home, 'pnpm', 'state'),
      NPM_CONFIG_GLOBAL_DIR: join(home, 'pnpm', 'global'),
      NPM_CONFIG_USERCONFIG: join(home, 'pnpm', 'npmrc'),
    })
  })

  it('packages a DSH Special identity, protocol, updater cache, and artifact namespace', () => {
    const config = createElectronBuilderConfig(UNSIGNED_WINDOWS, 'win32', 'x64')
    expect(config).toMatchObject({
      appId: 'com.deepseek.dshs',
      productName: 'DSH Special',
      protocols: [{ name: 'DSH Special', schemes: ['dshs'] }],
      extraMetadata: { name: 'dshs', dshDesktopAppId: 'com.deepseek.dshs' },
      artifactName: 'dshs-${version}-${os}-${arch}-unsigned.${ext}',
    })
  })

  it('derives Electron updater state from the edition package name', async () => {
    const config = createElectronBuilderConfig(UNSIGNED_WINDOWS, 'win32', 'x64')
    const packager = new Packager({
      projectDir: fileURLToPath(new URL('..', import.meta.url)),
      config: { appId: config.appId, productName: 'DSH Special', extraMetadata: config.extraMetadata },
    })
    await packager.validateConfig()
    expect(new AppInfo(packager, undefined).updaterCacheDirName).toBe('dshs-updater')
  })

  it('protects only the edition home during Windows uninstall', () => {
    const uninstaller = readFileSync(new URL('../installer/uninstall.nsh', import.meta.url), 'utf8')
    expect(uninstaller).toContain('ReadEnvStr $UnHome DSHS_HOME')
    expect(uninstaller).not.toContain('ReadEnvStr $UnHome DSH_HOME')
  })

  it('uses the edition app id in every checked-in packaging example', () => {
    for (const path of [
      '../.env.windows.example',
      '../.env.macos.example',
      '../config/windows-packaging/production.env.example',
      '../config/windows-packaging/test.env.example',
      '../config/macos-packaging/production.env.example',
      '../config/macos-packaging/test.env.example',
    ]) {
      expect(readFileSync(new URL(path, import.meta.url), 'utf8')).toContain('DSH_DESKTOP_APP_ID=com.deepseek.dshs')
    }
  })

  it('documents edition-owned homes and Electron data paths', () => {
    for (const path of [
      '../README.md',
      '../README.zh.md',
      '../../../docs/user/guide/desktop-uninstall-cleanup.md',
      '../../../docs/user/guide/desktop-uninstall-cleanup.zh.md',
    ]) {
      const document = readFileSync(new URL(path, import.meta.url), 'utf8')
      expect(document).not.toMatch(/\$DSH_HOME\b|\$DSH_AGENTS_HOME\b|~\/\.dsh\b|com\.deepseek\.dsh\b|@deepseek-ai[\\/]dshs-desktop/u)
    }
  })
})
