export interface AutomationPoint {
  time: number;
  value: number;
  curve?: 'linear' | 'exponential' | 'step';
}

export interface AutomationLaneData {
  id: string;
  parameter: string;
  points: AutomationPoint[];
  enabled: boolean;
}

export type AutomationCurve = 'linear' | 'exponential' | 'step';
