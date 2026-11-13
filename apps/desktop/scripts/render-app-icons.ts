/**
 * Render Desktop application, installer, and uninstaller artwork from the
 * edition-owned vector sources.
 *
 * The committed PNG files are generated outputs. Run
 * `pnpm --filter @deepseek-ai/dsh-desktop run render:app-icons` after changing
 * the whale or red tile, then run `render:tray-icon` for the Windows ICO.
 * @module render-app-icons
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RESOURCE_ROOT = fileURLToPath(new URL('../resources/', import.meta.url))
const INSTALLER_ROOT = fileURLToPath(new URL('../installer/assets/', import.meta.url))
const PRODUCT_NAME = 'DSH SPECIAL'
const PRODUCT_DESCRIPTION = 'NETWORK-ENGINEERING PENTEST EDITION'
const INK = '#0F1115'
const DARK_INK = '#F9FAFB'

/** One raster generated from a committed Desktop vector source. */
export interface DesktopIconVariant {
  readonly source: string
  readonly output: string
  readonly size: number
}

/** Application icon rasters consumed directly by electron-builder. */
export const DESKTOP_ICON_VARIANTS: readonly DesktopIconVariant[] = [
  { source: 'icon.svg', output: 'icon.png', size: 1104 },
  { source: 'icon-windows.svg', output: 'icon-windows.png', size: 1024 },
  { source: 'icon-macos.svg', output: 'icon-macos.png', size: 1024 },
]

/** Installer artwork rendered from the same red tile and product name. */
export const INSTALLER_ASSETS = [
  { output: 'brand.png', width: 600, height: 196, dark: false },
  { output: 'brand-2x.png', width: 1200, height: 392, dark: false },
  { output: 'brand-dark.png', width: 600, height: 196, dark: true },
  { output: 'brand-dark-2x.png', width: 1200, height: 392, dark: true },
  { output: 'uninstaller-sidebar.png', width: 164, height: 314, dark: false },
] as const

/**
 * Rasterize one SVG source at a square edge.
 * @param source - Complete SVG document.
 * @param size - Output edge in pixels.
 * @returns PNG bytes.
 */
export async function renderSvgPng(source: string | Buffer, size: number): Promise<Buffer> {
  return sharp(source, { density: 72 }).resize(size, size).png().toBuffer()
}

function brandSvg(width: number, height: number, dark: boolean): string {
  const scale = width / 600
  const ink = dark ? DARK_INK : INK
  const subtitleSize = Math.round(9 * scale)
  return `<svg width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}" fill="none" xmlns="http://www.w3.org/2000/svg">
<text x="${String(Math.round(300 * scale))}" y="${String(Math.round(144 * scale))}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${String(Math.round(30 * scale))}" font-weight="700" letter-spacing="${String(Math.round(3 * scale))}" fill="${ink}">${PRODUCT_NAME}</text>
<text x="${String(Math.round(300 * scale))}" y="${String(Math.round(166 * scale))}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="${String(subtitleSize)}" font-weight="500" letter-spacing="${String(Math.max(1, Math.round(1.2 * scale)))}" fill="${ink}">${PRODUCT_DESCRIPTION}</text>
</svg>`
}

function uninstallerSidebarSvg(width: number, height: number): string {
  return `<svg width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="${String(width)}" height="${String(height)}" fill="#F4F5F7"/>
<text x="${String(width / 2)}" y="232" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="1.8" fill="${INK}">${PRODUCT_NAME}</text>
<text x="${String(width / 2)}" y="251" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="6.4" font-weight="500" letter-spacing="0.8" fill="${INK}">NETWORK-ENGINEERING</text>
<text x="${String(width / 2)}" y="263" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="6.4" font-weight="500" letter-spacing="0.8" fill="${INK}">PENTEST EDITION</text>
</svg>`
}

async function renderInstallerAsset(asset: typeof INSTALLER_ASSETS[number], icon: Buffer): Promise<Buffer> {
  const scale = asset.width / 600
  if (asset.output === 'uninstaller-sidebar.png') {
    const iconSize = 88
    return sharp(Buffer.from(uninstallerSidebarSvg(asset.width, asset.height)))
      .composite([{ input: await renderSvgPng(icon, iconSize), left: 38, top: 70 }])
      .png()
      .toBuffer()
  }
  const iconSize = Math.round(96 * scale)
  return sharp(Buffer.from(brandSvg(asset.width, asset.height, asset.dark)))
    .composite([{ input: await renderSvgPng(icon, iconSize), left: Math.round(252 * scale), top: Math.round(20 * scale) }])
    .png()
    .toBuffer()
}

async function main(): Promise<void> {
  const windowsIcon = await readFile(resolve(RESOURCE_ROOT, 'icon-windows.svg'))
  for (const variant of DESKTOP_ICON_VARIANTS) {
    const source = await readFile(resolve(RESOURCE_ROOT, variant.source))
    await writeFile(resolve(RESOURCE_ROOT, variant.output), await renderSvgPng(source, variant.size))
  }
  for (const asset of INSTALLER_ASSETS) {
    await writeFile(resolve(INSTALLER_ROOT, asset.output), await renderInstallerAsset(asset, windowsIcon))
  }
  console.info(`desktop app icons: wrote ${DESKTOP_ICON_VARIANTS.map(variant => variant.output).join(', ')}`)
  console.info(`desktop installer art: wrote ${INSTALLER_ASSETS.map(asset => asset.output).join(', ')}`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
