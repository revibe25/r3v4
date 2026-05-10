import { colors } from '../styles/tokens/colors'

export interface RenderContext {
  canvas:    HTMLCanvasElement
  ctx:       CanvasRenderingContext2D
  width:     number
  height:    number
  zoom:      number
  playhead:  number
}

export function renderTimeline(rc: RenderContext): void {
  const { ctx, width, height, zoom, playhead } = rc

  ctx.clearRect(0, 0, width, height)

  // Background
  ctx.fillStyle = colors.bg.base
  ctx.fillRect(0, 0, width, height)

  // Grid lines
  ctx.strokeStyle = colors.bg.panel
  ctx.lineWidth = 1
  const step = 80 * zoom
  for (let x = 0; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Playhead
  const px = playhead * zoom
  ctx.strokeStyle = colors.timeline.playhead
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(px, 0)
  ctx.lineTo(px, height)
  ctx.stroke()
}
