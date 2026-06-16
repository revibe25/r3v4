import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Layout Store — DAW panel geometry and visibility state
 * 
 * Persists to localStorage so users don't lose their layout on reload.
 * All sizes are in pixels. Collapsed panels remember their previous width
 * so they restore on expand.
 */

interface PanelState {
  width: number;      // for left/right panels
  height: number;     // for bottom panels
  collapsed: boolean;
  prevWidth?: number; // remembered width before collapse
  prevHeight?: number; // remembered height before collapse
}

interface LayoutState {
  leftPanel: PanelState;
  rightPanel: PanelState;
  bottomPanel: PanelState;
  zoom: number;
  trackHeightMode: 'compact' | 'normal' | 'large';
}

const DEFAULTS: LayoutState = {
  leftPanel:   { width: 180, height: 200, collapsed: false },
  rightPanel:  { width: 280, height: 200, collapsed: false },
  bottomPanel: { width: 200, height: 160, collapsed: false },
  zoom: 1,
  trackHeightMode: 'normal',
};

const MIN_WIDTH = 120;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;

interface LayoutStore extends LayoutState {
  setPanelWidth:  (panel: 'left' | 'right', width: number) => void;
  setPanelHeight: (panel: 'bottom', height: number) => void;
  togglePanel:    (panel: 'left' | 'right' | 'bottom') => void;
  setZoom:        (zoom: number) => void;
  setTrackHeightMode: (mode: 'compact' | 'normal' | 'large') => void;
  resetLayout:    () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setPanelWidth: (panel, width) =>
        set((state) => {
          const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
          const key = panel === 'left' ? 'leftPanel' : 'rightPanel';
          return {
            [key]: {
              ...state[key],
              width: clamped,
              prevWidth: state[key].collapsed ? state[key].prevWidth : clamped,
            },
          } as Partial<LayoutState>;
        }),

      setPanelHeight: (panel, height) =>
        set((state) => {
          const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height));
          return {
            bottomPanel: {
              ...state.bottomPanel,
              height: clamped,
              prevHeight: state.bottomPanel.collapsed ? state.bottomPanel.prevHeight : clamped,
            },
          };
        }),

      togglePanel: (panel) =>
        set((state) => {
          if (panel === 'bottom') {
            const { collapsed, height, prevHeight } = state.bottomPanel;
            return {
              bottomPanel: {
                ...state.bottomPanel,
                collapsed: !collapsed,
                height: collapsed ? (prevHeight ?? DEFAULTS.bottomPanel.height) : height,
                prevHeight: collapsed ? prevHeight : height,
              },
            };
          }
          const key = panel === 'left' ? 'leftPanel' : 'rightPanel';
          const { collapsed, width, prevWidth } = state[key];
          return {
            [key]: {
              ...state[key],
              collapsed: !collapsed,
              width: collapsed ? (prevWidth ?? DEFAULTS[key].width) : width,
              prevWidth: collapsed ? prevWidth : width,
            },
          } as Partial<LayoutState>;
        }),

      setZoom: (zoom) =>
        set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

      setTrackHeightMode: (mode) =>
        set({ trackHeightMode: mode }),

      resetLayout: () => set(DEFAULTS),
    }),
    {
      name: 'daw-layout-v1',
      version: 1,
    }
  )
);

// Convenience selectors (stable references for useMemo)
export const selectLeftPanel = (s: LayoutState) => s.leftPanel;
export const selectRightPanel = (s: LayoutState) => s.rightPanel;
export const selectBottomPanel = (s: LayoutState) => s.bottomPanel;
export const selectZoom = (s: LayoutState) => s.zoom;
export const selectTrackHeightMode = (s: LayoutState) => s.trackHeightMode;
