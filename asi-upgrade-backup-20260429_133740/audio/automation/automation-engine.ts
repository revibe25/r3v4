// client/src/audio/automation/automation-engine.ts

import * as Tone from "tone";
import { AutomationLane } from "./automation-lane";
import { AutomationLaneData } from "@shared/types/automation.types";

export class AutomationEngine {
  private lanes = new Map<string, AutomationLane>();
  private paramResolver: (path: string) => AudioParam | null;

  constructor(
    paramResolver: (path: string) => AudioParam | null
  ) {
    this.paramResolver = paramResolver;

    Tone.Transport.on("start", () => {
      this.scheduleAll();
    });

    Tone.Transport.on("stop", () => {
      this.clearAll();
    });
  }

  loadLanes(data: AutomationLaneData[]) {
    this.lanes.clear();

    for (const laneData of data) {
      const param = this.paramResolver(
        (laneData as any).paramPath
      );
      if (!param) continue;

      const lane = new AutomationLane(
        laneData.id,
        param
      );
      lane.setPoints(laneData.points);
      this.lanes.set(laneData.id, lane);
    }
  }

  scheduleAll() {
    const startTime = Tone.now();

    for (const lane of this.lanes.values()) {
      lane.schedule(startTime);
    }
  }

  clearAll() {
    const now = Tone.now();
    for (const lane of this.lanes.values()) {
      lane.clear(now);
    }
  }

  reschedule() {
    this.clearAll();
    this.scheduleAll();
  }
}
