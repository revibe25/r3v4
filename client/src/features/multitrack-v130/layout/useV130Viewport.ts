import {
  useLayoutEffect,
  useState,
} from 'react';
import {
  fitV130Viewport,
  type V130Viewport,
} from './v130-layout';

export function useV130Viewport(
  host: HTMLElement | null,
): V130Viewport {
  const [viewport, setViewport] =
    useState<V130Viewport>(() =>
      fitV130Viewport(
        typeof window === 'undefined'
          ? 1536
          : window.innerWidth,
        typeof window === 'undefined'
          ? 1024
          : window.innerHeight,
      ),
    );

  useLayoutEffect(() => {
    if (!host) return;

    const measure = () => {
      setViewport(
        fitV130Viewport(
          Math.max(
            1,
            host.clientWidth ||
              window.innerWidth,
          ),
          Math.max(
            1,
            host.clientHeight ||
              window.innerHeight,
          ),
        ),
      );
    };

    measure();

    const observer =
      new ResizeObserver(measure);

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, [host]);

  return viewport;
}
