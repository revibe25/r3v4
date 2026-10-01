export const V130_DESIGN_WIDTH = 1536;
export const V130_DESIGN_HEIGHT = 1024;

export const V130_PANEL_IDS = [
  'side',
  'arr',
  'routing',
  'takes',
  'padsP',
  'pianoP',
  'mixer',
  'dsp',
  'ana',
] as const;

export type V130PanelId = typeof V130_PANEL_IDS[number];

export const V130_PANEL_TITLES: Record<V130PanelId, string> = {
  side: 'Sidebar',
  arr: 'Tracks',
  routing: 'Routing & busses',
  takes: 'Take lane',
  padsP: 'Pad controller',
  pianoP: 'Piano / MIDI',
  mixer: 'Mixer',
  dsp: 'Inserts / DSP',
  ana: 'Master analyzer',
};
