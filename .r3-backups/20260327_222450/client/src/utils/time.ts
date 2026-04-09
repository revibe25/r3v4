export const PIXELS_PER_SECOND = 100;

export function timeToPixels(timeInSeconds: number, zoom = 1): number {
  return timeInSeconds * PIXELS_PER_SECOND * zoom;
}

export function pixelsToTime(pixels: number, zoom = 1): number {
  return pixels / (PIXELS_PER_SECOND * zoom);
}

export function snapToGrid(time: number, gridSize: number): number {
  return Math.round(time / gridSize) * gridSize;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
