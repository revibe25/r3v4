/**
 * shared/automation.types.ts — Canonical automation types for R3 v4
 */

export type AutomationMode = "off" | "read" | "write" | "touch" | "latch";
export type AutomationCurve = "linear" | "bezier" | "step";

export interface AutomationPoint {
  id: string;
  position: number;     // in ticks
  value: number;        // normalized 0–1
  curve: AutomationCurve;
}

export interface AutomationLane {
  id: string;
  trackId: string;
  parameterId: string;  // e.g. "volume" | "pan" | "send:1" | "plugin:1:param:0"
  parameterName: string;
  mode: AutomationMode;
  points: AutomationPoint[];
  visible: boolean;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}

export interface SmartControl {
  id: string;
  name: string;
  value: number;        // 0–1 normalized
  mappings: SmartControlMapping[];
}

export interface SmartControlMapping {
  parameterId: string;
  trackId: string;
  minValue: number;
  maxValue: number;
}

export function interpolateAutomation(
  lane: AutomationLane,
  tick: number
): number {
  if (lane.points.length === 0) return lane.defaultValue;
  const sorted = [...lane.points].sort((a, b) => a.position - b.position);
  if (tick <= sorted[0].position) return sorted[0].value;
  if (tick >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (tick >= a.position && tick <= b.position) {
      const t = (tick - a.position) / (b.position - a.position);
      if (b.curve === "step") return a.value;
      return a.value + (b.value - a.value) * t;
    }
  }
  return lane.defaultValue;
}



// ── Merged from shared/types/ (conflict resolution) ─────────────────────────
export interface AutomationLaneData {
  id: string;
  parameter: string;
  points: AutomationPoint[];
  enabled: boolean;
}
