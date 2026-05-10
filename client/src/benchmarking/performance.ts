// WARN-7: original had no cancel handle and spammed console.log at 60 fps.
// Accept an optional logger (default: no-op) and return a cancel function.

type Logger = (fps: number) => void

export function measureFPS(
  callback: () => void,
  logger: Logger = () => undefined
): () => void {
  let last   = performance.now()
  let handle = 0

  function loop(now: number): void {
    const fps = 1000 / (now - last)
    last = now
    logger(fps)
    callback()
    handle = requestAnimationFrame(loop)
  }

  handle = requestAnimationFrame(loop)

  // Return a cancel function
  return () => { cancelAnimationFrame(handle) }
}
