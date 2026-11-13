import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENTS_HOME_DIR_NAME,
  DEFAULT_AGENTS_HOME_DISPLAY,
  DEFAULT_DSH_HOME_DISPLAY,
  DSH_HOME_DIR_NAME,
  agentsHomeDisplay,
  canonicalizeWatchPath,
  defaultAgentsHome,
  defaultDshHome,
  dshCachePath,
  dshHomeDisplay,
  dshHomePath,
  expandHomePath,
  pnpmEnvironment,
  resolveAgentsHome,
  resolveDshHome,
} from '@deepseek-ai/dsh-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('dsh path helpers', () => {
  it('owns this edition\'s default home directory name', () => {
    expect(DSH_HOME_DIR_NAME).toBe('.dshs')
    expect(DEFAULT_DSH_HOME_DISPLAY).toBe('~/.dshs')
    expect(defaultDshHome()).toBe(join(homedir(), '.dshs'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.dshs')).toBe(join(homedir(), '.dshs'))
    expect(expandHomePath('~\\.dshs')).toBe(join(homedir(), '.dshs'))
    expect(expandHomePath('/tmp/.dshs')).toBe('/tmp/.dshs')
    expect(expandHomePath('~other/.dshs')).toBe('~other/.dshs')
  })

  it('resolves explicit path before DSHS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-dsh')

    expect(resolveDshHome('/tmp/explicit-dsh', { DSHS_HOME: '~/env-dsh' })).toBe(resolve('/tmp/explicit-dsh'))
    expect(resolveDshHome(undefined, { DSHS_HOME: '~/env-dsh' })).toBe(envHome)
    expect(resolveDshHome(undefined, {})).toBe(defaultDshHome())
  })

  it('ignores DSH_HOME so an official install does not share this home', () => {
    expect(resolveDshHome(undefined, { DSH_HOME: '/official' })).toBe(defaultDshHome())
    expect(resolveDshHome(undefined, { DSH_HOME: '/official', DSHS_HOME: '~/special' })).toBe(join(homedir(), 'special'))
  })

  it('treats an empty or whitespace-only DSHS_HOME as unset', () => {
    expect(resolveDshHome(undefined, { DSHS_HOME: '' })).toBe(defaultDshHome())
    expect(resolveDshHome(undefined, { DSHS_HOME: '   ' })).toBe(defaultDshHome())
  })

  it('joins child segments onto the resolved DSHS_HOME', () => {
    vi.stubEnv('DSHS_HOME', '~/env-dsh')
    expect(dshHomePath()).toBe(join(homedir(), 'env-dsh'))
    expect(dshHomePath('storages', 'cache')).toBe(join(homedir(), 'env-dsh', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(dshHomeDisplay(resolve(defaultDshHome()))).toBe('~/.dshs')
    expect(dshHomeDisplay('/some/other/root')).toBe('$DSHS_HOME')
  })

  it('keeps the default agents root under this edition home', () => {
    expect(AGENTS_HOME_DIR_NAME).toBe('agents')
    expect(DEFAULT_AGENTS_HOME_DISPLAY).toBe('~/.dshs/agents')
    expect(defaultAgentsHome()).toBe(join(homedir(), '.dshs', 'agents'))
  })

  it('resolves an explicit agents home before DSHS_AGENTS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-agents')

    expect(resolveAgentsHome('/tmp/explicit-agents', { DSHS_AGENTS_HOME: '~/env-agents' })).toBe(resolve('/tmp/explicit-agents'))
    expect(resolveAgentsHome(undefined, { DSHS_AGENTS_HOME: '~/env-agents' })).toBe(envHome)
    expect(resolveAgentsHome(undefined, {})).toBe(defaultAgentsHome())
  })

  it('ignores official agent-home settings', () => {
    expect(resolveAgentsHome(undefined, {
      DSH_AGENTS_HOME: '/official/agents',
      DSH_HOME: '/official',
    })).toBe(defaultAgentsHome())
  })

  it('treats an empty or whitespace-only DSHS_AGENTS_HOME as unset', () => {
    expect(resolveAgentsHome(undefined, { DSHS_AGENTS_HOME: '' })).toBe(defaultAgentsHome())
    expect(resolveAgentsHome(undefined, { DSHS_AGENTS_HOME: '   ' })).toBe(defaultAgentsHome())
  })

  it('labels a resolved agents home by whether it is the default root', () => {
    expect(agentsHomeDisplay(resolve(defaultAgentsHome()))).toBe('~/.dshs/agents')
    expect(agentsHomeDisplay('/some/other/root')).toBe('$DSHS_AGENTS_HOME')
  })

  it('keeps package-manager state under the edition home', () => {
    const home = join(homedir(), 'edition-home')
    expect(pnpmEnvironment(home, { PATH: '/bin', NPM_CONFIG_USERCONFIG: '/shared/.npmrc' })).toEqual({
      PATH: '/bin',
      PNPM_HOME: join(home, 'pnpm', 'bin'),
      NPM_CONFIG_STORE_DIR: join(home, 'cache', 'pnpm', 'store'),
      NPM_CONFIG_CACHE_DIR: join(home, 'cache', 'pnpm'),
      NPM_CONFIG_STATE_DIR: join(home, 'pnpm', 'state'),
      NPM_CONFIG_GLOBAL_DIR: join(home, 'pnpm', 'global'),
      NPM_CONFIG_USERCONFIG: join(home, 'pnpm', 'npmrc'),
    })
  })

  it.each([
    [undefined, join(homedir(), '.dshs')],
    ['', join(homedir(), '.dshs')],
    ['   ', join(homedir(), '.dshs')],
    ['~/env-dsh', join(homedir(), 'env-dsh')],
    ['./relative-dsh', resolve('./relative-dsh')],
  ] as const)('resolves cache paths with DSHS_HOME=%j', (home, expectedHome) => {
    vi.stubEnv('DSHS_HOME', home)
    try {
      expect(dshCachePath()).toBe(join(expectedHome, 'cache'))
      expect(dshCachePath('models', 'index.json')).toBe(join(expectedHome, 'cache', 'models', 'index.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('resolves configured cache homes before the environment', () => {
    vi.stubEnv('DSHS_HOME', '~/env-dsh')
    try {
      expect(dshCachePath({ dshHome: '~/explicit-dsh' })).toBe(join(homedir(), 'explicit-dsh', 'cache'))
      expect(dshCachePath({ dshHome: './explicit-dsh' }, 'attachments', 'request-images'))
        .toBe(resolve('./explicit-dsh/cache/attachments/request-images'))
      expect(dshCachePath({}, 'attachments')).toBe(join(homedir(), 'env-dsh', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(alias)).resolves.toBe(await realpath(target))
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
