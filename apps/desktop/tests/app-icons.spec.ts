import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_ICON_VARIANTS,
  INSTALLER_ASSETS,
  renderSvgPng,
} from '../scripts/render-app-icons.ts'

const RESOURCE_ROOT = fileURLToPath(new URL('../resources/', import.meta.url))
const INSTALLER_ROOT = fileURLToPath(new URL('../installer/assets/', import.meta.url))

async function redPixels(path: string): Promise<number> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let red = 0
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index]! > 120 && data[index]! > data[index + 1]! * 1.5 && data[index]! > data[index + 2]! * 1.5) red++
  }
  return red
}

describe('DSH Special desktop artwork', () => {
  it.each(DESKTOP_ICON_VARIANTS)('keeps $output generated from $source', async (variant) => {
    const source = await readFile(resolve(RESOURCE_ROOT, variant.source))
    const expected = await renderSvgPng(source, variant.size)
    const output = resolve(RESOURCE_ROOT, variant.output)
    expect(await readFile(output)).toEqual(expected)
    const metadata = await sharp(output).metadata()
    expect([metadata.width, metadata.height]).toEqual([variant.size, variant.size])
    expect(await redPixels(output)).toBeGreaterThan(variant.size * variant.size * 0.2)
  })

  it.each(DESKTOP_ICON_VARIANTS)('uses a red rather than white tile in $source', async (variant) => {
    const source = await readFile(resolve(RESOURCE_ROOT, variant.source), 'utf8')
    expect(source).toContain('#D92D20')
    expect(source).not.toContain('#FBFBFB')
    expect(source).not.toContain('#D4DBE9')
    expect(source).not.toContain('#E1E6EE')
  })

  it.each(INSTALLER_ASSETS)('ships red, edition-named $output', async (asset) => {
    const output = resolve(INSTALLER_ROOT, asset.output)
    const metadata = await sharp(output).metadata()
    expect([metadata.width, metadata.height]).toEqual([asset.width, asset.height])
    expect(await redPixels(output)).toBeGreaterThan(asset.width * asset.height * 0.03)
  })
})
