import { useRef, useCallback } from 'react';
export function useInertialDrag(friction = 0.92) {
    const velocity = useRef(0);
    const applyVelocity = useCallback((delta) => {
        velocity.current = delta;
    }, []);
    const decay = useCallback(() => {
        velocity.current *= friction;
    }, [friction]);
    return { velocity, applyVelocity, decay };
}
