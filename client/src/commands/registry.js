export const commands = [
    { id: 'transport.play', title: 'Play Timeline', shortcut: 'Space' },
    { id: 'transport.stop', title: 'Stop Timeline', shortcut: 'Space' },
    { id: 'timeline.zoomIn', title: 'Zoom In', shortcut: 'Meta+=' }
];
const registry = new Map(commands.map((c) => [c.id, c]));
export function registerCommand(cmd) {
    registry.set(cmd.id, cmd);
}
export function executeCommand(id) {
    registry.get(id)?.handler?.();
}
