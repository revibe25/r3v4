export interface Command {
  id:       string
  title:    string
  shortcut?: string
  handler?: () => void
}

export const commands: Command[] = [
  { id: 'transport.play',  title: 'Play Timeline',  shortcut: 'Space' },
  { id: 'transport.stop',  title: 'Stop Timeline',  shortcut: 'Space' },
  { id: 'timeline.zoomIn', title: 'Zoom In',        shortcut: 'Meta+=' }
]

const registry = new Map<string, Command>(commands.map((c) => [c.id, c]))

export function registerCommand(cmd: Command): void {
  registry.set(cmd.id, cmd)
}

export function executeCommand(id: string): void {
  registry.get(id)?.handler?.()
}
