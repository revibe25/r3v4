export interface V130PanelState {
  collapsed: boolean;
  render3D: boolean;
}

export interface V130PanelStateMap {
  side: V130PanelState;
  arr: V130PanelState;
  routing: V130PanelState;
  takes: V130PanelState;
  padsP: V130PanelState;
  pianoP: V130PanelState;
  mixer: V130PanelState;
  dsp: V130PanelState;
  ana: V130PanelState;
}

export interface V130AutomationPoint {
  bar: number;
  value: number;
}

export interface V130TakeState {
  index: number;
}

export interface V130BusState {
  id: string;
  name: string;
}

export interface V130SendState {
  id: string;
  from: string;
  to: string;
  level: number;
}
