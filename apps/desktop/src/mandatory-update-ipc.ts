/** Dependency-free IPC names shared with the sandboxed mandatory-update preload. */
export const MANDATORY_IPC = {
  status: 'dshs-desktop:mandatory-status', state: 'dshs-desktop:mandatory-state', action: 'dshs-desktop:mandatory-action',
} as const
