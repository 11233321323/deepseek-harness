/** This edition stays beside an official dsh install. */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DSH_HOME_DIR_NAME, DSH_HOME_ENV, defaultDshHome, resolveDshHome } from '@deepseek-ai/dsh-home-paths'

const root = new URL('../../../', import.meta.url)

describe('dshs edition isolation', () => {
  it('publishes the dshs command and not dsh', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { bin: Record<string, string> }
    expect(pkg.bin).toEqual({ dshs: 'lib/bin.js' })
  })

  it('keeps the home and Web port off the official defaults', () => {
    expect(DSH_HOME_ENV).toBe('DSHS_HOME')
    expect(DSH_HOME_DIR_NAME).toBe('.dshs')
    expect(defaultDshHome()).toBe(join(homedir(), '.dshs'))
    expect(resolveDshHome(undefined, { DSH_HOME: '/official' })).toBe(defaultDshHome())
    const web = readFileSync(new URL('packages/bundle/web-app/cordis.patch.yml', root), 'utf8')
    expect(web).toContain('ctx.webStartup.port ?? 3180')
    expect(web).toContain('https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json')
    expect(web).toContain('@deepseek-ai/dsh-client-ui-plugin-market')
    const standard = readFileSync(new URL('packages/bundle/web-app/presets/standard.patch.yml', root), 'utf8')
    expect(standard).not.toContain('@deepseek-ai/dsh-tool-ssh')
    const headless = readFileSync(new URL('packages/bundle/headless/cordis.patch.yml', root), 'utf8')
    expect(headless).not.toContain('@deepseek-ai/dsh-tool-ssh')
  })

  it('uses a community SSH plugin without removing the official SSH providers', () => {
    expect(existsSync(new URL('packages/ssh/tool-ssh', root))).toBe(false)
    for (const provider of ['ssh', 'fs-ssh', 'sandbox-ssh', 'subprocess-ssh', 'ssh-helper-runtime']) {
      expect(existsSync(new URL(`packages/ssh/${provider}/package.json`, root))).toBe(true)
    }
    const readme = readFileSync(new URL('README.md', root), 'utf8')
    expect(readme).toContain('@lemoncat7/dsh-ssh')
    expect(readme).toContain('dshs plugin --profile web add @lemoncat7/dsh-ssh@latest')
  })
})
