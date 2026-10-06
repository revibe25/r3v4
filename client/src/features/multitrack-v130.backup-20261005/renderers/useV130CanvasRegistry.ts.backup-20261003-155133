import {
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';

import type {
  V130Viewport,
} from '../layout/v130-layout';

import {
  V130CanvasRegistry,
} from './v130-canvas-registry';

export function useV130CanvasRegistry(
  rootRef: RefObject<
    HTMLElement | null
  >,
  viewport: V130Viewport,
): V130CanvasRegistry {
  const registryRef =
    useRef<
      V130CanvasRegistry | null
    >(null);

  if (!registryRef.current) {
    registryRef.current =
      new V130CanvasRegistry();
  }

  useLayoutEffect(() => {
    const root =
      rootRef.current;

    const registry =
      registryRef.current;

    if (!root || !registry) {
      return;
    }

    const sync = () => {
      registry.removeDetached();

      root
        .querySelectorAll('canvas')
        .forEach((canvas) => {
          const width =
            Math.max(
              1,
              canvas.clientWidth,
            );

          const height =
            Math.max(
              1,
              canvas.clientHeight,
            );

          registry.add(
            canvas,
            width,
            height,
            viewport.scale,
          );
        });
    };

    sync();

    const resizeObserver =
      new ResizeObserver(sync);

    resizeObserver.observe(root);

    // Watch for new canvases being added to DOM (e.g., Master Analyzer)
    const mutationObserver =
      new MutationObserver(sync);

    mutationObserver.observe(root, {
      childList: true,  // Watch for added/removed elements
      subtree: true,    // Watch all descendants
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      registry.removeDetached();
    };
  }, [
    rootRef,
    viewport.scale,
  ]);

  return registryRef.current;
}
