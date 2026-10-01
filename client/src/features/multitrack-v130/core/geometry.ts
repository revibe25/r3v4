import {
  V130_DESIGN_HEIGHT,
  V130_DESIGN_WIDTH,
} from './constants';

export interface V130ViewportFit {
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
}

export function fitV130Viewport(
  width: number,
  height: number,
): V130ViewportFit {
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const scale = Math.min(
    w / V130_DESIGN_WIDTH,
    h / V130_DESIGN_HEIGHT,
  );

  return {
    scale,
    logicalWidth: w / scale,
    logicalHeight: h / scale,
  };
}
