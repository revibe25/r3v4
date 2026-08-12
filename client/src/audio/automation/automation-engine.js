// client/src/audio/automation/automation-engine.ts
import * as Tone from "tone";
import { AutomationLane } from "./automation-lane";
export class AutomationEngine {
    constructor(paramResolver) {
        this.lanes = new Map();
        this.paramResolver = paramResolver;
        Tone.Transport.on("start", () => {
            this.scheduleAll();
        });
        Tone.Transport.on("stop", () => {
            this.clearAll();
        });
    }
    loadLanes(data) {
        this.lanes.clear();
        for (const laneData of data) {
            const param = this.paramResolver(laneData.paramPath);
            if (!param)
                continue;
            const lane = new AutomationLane(laneData.id, param);
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
