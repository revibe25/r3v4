import { useMemo } from 'react';
import { fitV130Viewport } from './core/geometry';
import {
  V130_DESIGN_HEIGHT,
  V130_DESIGN_WIDTH,
} from './core/constants';
import { getV130StoreSnapshot } from './adapters/store-adapter';

export default function MultitrackV130() {
  const viewport = useMemo(
    () => fitV130Viewport(window.innerWidth, window.innerHeight),
    [],
  );

  const store = getV130StoreSnapshot();

  return (
    <div
      data-r3-v130="true"
      data-design-width={V130_DESIGN_WIDTH}
      data-design-height={V130_DESIGN_HEIGHT}
      data-store-track-count={store.tracks.length}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        data-r3-v130-stage="true"
        style={{
          width: `${viewport.logicalWidth}px`,
          height: `${viewport.logicalHeight}px`,
          transform: `scale(${viewport.scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}
