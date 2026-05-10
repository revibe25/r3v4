import { useRef, useCallback } from 'react'

interface InertialDragState {
  velocity: React.MutableRefObject<number>
  applyVelocity: (delta: number) => void
  decay: () => void
}

export function useInertialDrag(friction = 0.92): InertialDragState {
  const velocity = useRef(0)

  const applyVelocity = useCallback((delta: number) => {
    velocity.current = delta
  }, [])

  const decay = useCallback(() => {
    velocity.current *= friction
  }, [friction])

  return { velocity, applyVelocity, decay }
}
