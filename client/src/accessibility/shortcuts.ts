export const shortcuts = {
  PLAY:            'Space',
  COMMAND_PALETTE: 'Meta+K',
  SPLIT_CLIP:      'S',
  DUPLICATE:       'Meta+D',
  UNDO:            'Meta+Z',
  REDO:            'Meta+Shift+Z'
} as const

export type ShortcutKey = keyof typeof shortcuts
