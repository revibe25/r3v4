import {
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';

import type { V130Viewport } from '../layout/v130-layout';
import {
  V130_REFERENCE_BODY_HTML,
  V130_REFERENCE_BODY_SHA256,
} from './reference-body';
import { useV130PanelState } from '../layout/useV130PanelState';
import { useV130PanelRuntime } from '../layout/useV130PanelRuntime';

interface V130ReferenceDomShellProps {
  viewport: V130Viewport;
  audioGraph: any; // AudioGraph singleton instance
}

export default function V130ReferenceDomShell({
  viewport,
  audioGraph,
}: V130ReferenceDomShellProps) {
  const domRef =
    useRef<HTMLDivElement>(null);

  const panelController =
    useV130PanelState();

  useV130PanelRuntime(
    domRef,
    panelController,
    audioGraph,
  );


  const syncStage =
    useCallback(() => {
      const root =
        domRef.current;

      if (!root) return;

      const stage =
        root.querySelector<HTMLElement>(
          '#stage',
        );

      if (!stage) return;

      stage.style.width =
        `${viewport.logicalWidth}px`;

      stage.style.height =
        `${viewport.logicalHeight}px`;

      stage.style.transform =
        `scale(${viewport.scale})`;

      stage.dataset.v130Scale =
        viewport.scale.toFixed(6);

      stage.dataset.v130BodySha256 =
        V130_REFERENCE_BODY_SHA256;
    }, [
      viewport.logicalWidth,
      viewport.logicalHeight,
      viewport.scale,
    ]);

  useLayoutEffect(() => {
    syncStage();
  }, [syncStage]);

  return (
    <div
      ref={domRef}
      data-v130-body-sha256={
        V130_REFERENCE_BODY_SHA256
      }
      dangerouslySetInnerHTML={{
        __html:
          V130_REFERENCE_BODY_HTML,
      }}
    />
  );
}
