// client/src/audio/automation/automation-lane.ts

import type { AutomationPoint } from "@shared/types/automation.types";

export class AutomationLane {
  readonly id: string;
  readonly param: AudioParam;
  private points: AutomationPoint[] = [];

  constructor(id: string, param: AudioParam) {
    this.id = id;
    this.param = param;
  }

  setPoints(points: AutomationPoint[]) {
    this.points = [...points].sort(
      (a, b) => a.time - b.time
    );
  }

  clear(fromTime = 0) {
    this.param.cancelScheduledValues(fromTime);
  }

  schedule(startTime = 0) {
    if (this.points.length === 0) return;

    this.clear(startTime);

    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const t = startTime + point.time;

      if (point.curve === "step") {
        this.param.setValueAtTime(point.value, t);
      } else if (point.curve === "exponential") {
        this.param.exponentialRampToValueAtTime(
          Math.max(point.value, 0.0001),
          t
        );
      } else {
        // linear (default)
        if (i === 0) {
          this.param.setValueAtTime(point.value, t);
        } else {
          this.param.linearRampToValueAtTime(
            point.value,
            t
          );
        }
      }
    }
  }
}
