export interface VocalSpectraParameter {
  id: string;
  defaultValue: number;
  smoothingTimeMs: number;
}

export const VocalSpectraParameters: VocalSpectraParameter[] = [
  { id: 'correction',    defaultValue: 100,  smoothingTimeMs: 20  },
  { id: 'eqDrive',      defaultValue: 0,    smoothingTimeMs: 10  },
  { id: 'deEssThresh',  defaultValue: -12,  smoothingTimeMs: 10  },
  { id: 'gainTarget',   defaultValue: -18,  smoothingTimeMs: 50  },
  { id: 'pitchSpeed',   defaultValue: 0.5,  smoothingTimeMs: 0   },
  { id: 'bypass',       defaultValue: 0,    smoothingTimeMs: 0   },
];
