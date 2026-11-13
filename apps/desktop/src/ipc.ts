import type { DesktopFileActions } from '@deepseek-ai/dsh-client-ui-file-actions/types'
/** Typed preload operations exposed only by the Electron shell. */

export type { DesktopChannelState, DesktopChannelChangeResult } from '@deepseek-ai/dsh-client-ui-settings-general/types'
import type { DesktopChannelBridge, DesktopChannelState } from '@deepseek-ai/dsh-client-ui-settings-general/types'
import type { DesktopKeyboardApi, DesktopShortcutsApi } from '@deepseek-ai/dsh-client-shortcuts/protocol'
import type { IpcMainInvokeEvent } from 'electron'
import type { DesktopBrowserBridge } from '@deepseek-ai/dsh-client-ui-sidebar-browser/types'
import type { DesktopFileDrag } from '@deepseek-ai/dsh-util-file-drag'

/** IPC channel names kept private to the desktop application bundle. */
export const DESKTOP_IPC = {
  fileSave: 'dshs-desktop:file-save',
  clipboardImageRead: 'dshs-desktop:clipboard-image-read',
  shortcutsInput: 'dshs-desktop:shortcuts-input',
  shortcutsCloseWindow: 'dshs-desktop:shortcuts-close-window',
  shortcutsGet: 'dshs-desktop:shortcuts-get',
  shortcutsEdit: 'dshs-desktop:shortcuts-edit',
  shortcutsChanged: 'dshs-desktop:shortcuts-changed',
  shortcutsRecording: 'dshs-desktop:shortcuts-recording',
  boot: 'dshs-desktop:boot',
  enterWorkspace: 'dshs-desktop:enter-workspace',
  onboardingActive: 'dshs-desktop:onboarding-active',
  onboardingApiKey: 'dshs-desktop:onboarding-api-key',
  bootFailed: 'dshs-desktop:boot-failed',
  browserAcquire: 'dshs-desktop:browser-acquire',
  browserRelease: 'dshs-desktop:browser-release',
  browserOpenRequested: 'dshs-desktop:browser-open-requested',
  directoryPick: 'dshs-desktop:directory-pick',
  fileDragPrepare: 'dshs-desktop:file-drag-prepare',
  fileDragCancel: 'dshs-desktop:file-drag-cancel',
  fileDragStart: 'dshs-desktop:file-drag-start',
  fileDragRelease: 'dshs-desktop:file-drag-release',
  deviceInfo: 'dshs-desktop:device-info',
  localeBootstrap: 'dshs-desktop:locale-bootstrap',
  localeChanged: 'dshs-desktop:locale-changed',
  updatesChannelGet: 'dshs-desktop:updates-channel-get',
  updatesChannelSet: 'dshs-desktop:updates-channel-set',
  updatesChannelChanged: 'dshs-desktop:updates-channel-changed',
  updatesStatus: 'dshs-desktop:updates-status',
  updatesOpen: 'dshs-desktop:updates-open',
  updatesPresentation: 'dshs-desktop:updates-presentation',
  nativeThemeSet: 'dshs-desktop:native-theme-set',
  windowFullscreen: 'dshs-desktop:window-fullscreen',
  windowsAppearance: 'dshs-desktop:windows-appearance',
  windowsMenu: 'dshs-desktop:windows-menu',
} as const

/** Desktop release update state rendered by desktop-owned UI. */
export type DesktopUpdatePreparationFailureKind = 'stop-failed' | 'tasks-changed' | 'tasks-unavailable' | 'fullscreen-timeout'

export interface DesktopUpdateState {
  readonly phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing' | 'ready' | 'error'
  readonly version?: string
  readonly message?: string
  /** Main-owned diagnostics without subprocess output or credentials; hidden until expanded. */
  readonly technicalDetails?: string
  readonly percent?: number
  readonly failedOperation?: 'check' | 'download' | 'install' | 'configuration'
  /** Main-owned preparation cause; UI wording is selected by the active locale. */
  readonly preparationFailure?: DesktopUpdatePreparationFailureKind
  /** Current filesystem failure, independent of previous cache cleanup attempts. */
  readonly downloadFailure?: 'space' | 'permission' | 'busy'
}

/** Classified failure copy selected by the Web locale without exposing raw updater diagnostics. */
export type DesktopUpdateFailureKind =
  | 'configuration'
  | 'check'
  | 'check-network'
  | 'download'
  | 'download-network'
  | 'download-space'
  | 'download-permission'
  | 'download-busy'
  | 'install'
  | 'install-network'
  | 'stop-failed'
  | 'tasks-changed'
  | 'tasks-unavailable'
  | 'fullscreen-timeout'

/** Semantic status content; actions open main-process confirmation dialogs only. */
export interface DesktopUpdatePresentation {
  readonly phase: DesktopUpdateState['phase']
  readonly version?: string
  readonly percent?: number
  readonly failure?: DesktopUpdateFailureKind
  readonly configurationError?: DesktopChannelState['error']
}

/** Product documents cannot supply update versions, package URLs, or installation authorization. */
export interface DshDesktopProductApi {
  readonly fileActions: DesktopFileActions
  readonly protocolVersion: 1
  readonly browser: DesktopBrowserBridge
  readonly fileDrag: DesktopFileDrag
  readonly keyboard: DesktopKeyboardApi
  readonly shortcuts: DesktopShortcutsApi
  /**
   * Local machine description for the feedback questionnaire.
   * @returns `name=value` fields separated by `; `, with no hostname, user name, or serial number.
   */
  deviceInfo(): Promise<string>
  readonly updates: {
    readonly channels: DesktopChannelBridge
    status(): Promise<DesktopUpdatePresentation>
    open(): Promise<void>
    subscribe(listener: (state: DesktopUpdatePresentation) => void): () => void
  }
}

/** Scheme of Desktop-owned application documents. */
export const SCHEME = 'dsh-app'

/**
 * Reject IPC outside the allowed Desktop document origins.
 * @param event - IPC caller whose frame URL supplies the origin.
 * @param hostnames - Desktop document hosts allowed for this operation.
 */
export function assertDesktopSender(event: IpcMainInvokeEvent, hostnames: readonly string[]): void {
  const senderFrame = event.senderFrame
  if (senderFrame === null) throw new Error('dsh desktop: rejected IPC without a sender frame')
  const url = new URL(senderFrame.url)
  if (url.protocol !== `${SCHEME}:` || !hostnames.includes(url.hostname)) {
    throw new Error('dsh desktop: rejected IPC from an unowned renderer')
  }
}
