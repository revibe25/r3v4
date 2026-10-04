export const V130_DESIGN_W = 1536;
export const V130_DESIGN_H = 1024;

export const V130_ROWS_DEFAULT =
  '58px 26px minmax(0,474fr) minmax(0,434fr) 32px';

export const V130_FILL = 'minmax(0,1fr)';

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

export type V130PanelId =
  typeof V130_PANEL_IDS[number];

export const V130_PANEL_TITLE: Record<
  V130PanelId,
  string
> = {
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

export interface V130PanelState {
  c: boolean;
  d3: boolean;
}

export type V130PanelStateMap =
  Record<V130PanelId, V130PanelState>;

export interface V130DesignSize {
  w: number;
  h: number;
}

export type V130DesignMap =
  Partial<Record<V130PanelId, V130DesignSize>>;

export interface V130PanelDelta {
  dw: number;
  dh: number;
}

export interface V130Viewport {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  logicalWidth: number;
  logicalHeight: number;
}

export interface V130LayoutColumn {
  id: string;
  w: string;
  rail: string;
  stack?: readonly V130PanelId[];
  rows?: readonly [string, string];
}

export interface V130LayoutRow {
  cols: readonly V130LayoutColumn[];
  grow: readonly string[];
}

export interface V130DerivedLayout {
  rows: string;
  mainCols: string;
  bottomCols: string;
  rightRows: string;
  leftRows: string;
  dockedMain: boolean;
  dockedBottom: boolean;
  allCollapsed: boolean;
}

export const V130_LAYOUT = {
  main: {
    grow: ['arr', 'right'],
    cols: [
      {
        id: 'side',
        w: '150px',
        rail: '44px',
      },
      {
        id: 'arr',
        w: V130_FILL,
        rail: '30px',
      },
      {
        id: 'right',
        w: '300px',
        rail: '30px',
        stack: ['routing', 'takes'] as const,
        rows: ['1fr', '162px'] as const,
      },
    ] as const,
  },

  bottom: {
    grow: ['ana', 'dsp', 'mixer', 'left'],
    cols: [
      {
        id: 'left',
        w: '318px',
        rail: '30px',
        stack: ['padsP', 'pianoP'] as const,
        rows: ['1fr', '150px'] as const,
      },
      {
        id: 'mixer',
        w: '490px',
        rail: '30px',
      },
      {
        id: 'dsp',
        w: '330px',
        rail: '30px',
      },
      {
        id: 'ana',
        w: V130_FILL,
        rail: '30px',
      },
    ] as const,
  },
} as const;

export function createDefaultV130PanelState():
  V130PanelStateMap {
  return Object.fromEntries(
    V130_PANEL_IDS.map((id) => [
      id,
      {
        c: false,
        d3: false,
      },
    ]),
  ) as V130PanelStateMap;
}

export function cloneV130PanelState(
  state: V130PanelStateMap,
): V130PanelStateMap {
  return Object.fromEntries(
    V130_PANEL_IDS.map((id) => [
      id,
      {
        c: !!state[id]?.c,
        d3: !!state[id]?.d3,
      },
    ]),
  ) as V130PanelStateMap;
}

export function fitV130Viewport(
  width: number,
  height: number,
): V130Viewport {
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const scale = Math.min(
    w / V130_DESIGN_W,
    h / V130_DESIGN_H,
  );

  return {
    viewportWidth: w,
    viewportHeight: h,
    scale,
    logicalWidth: w / scale,
    logicalHeight: h / scale,
  };
}

export function isV130PanelOpen(
  state: V130PanelStateMap,
  id: V130PanelId,
  max: V130PanelId | null,
): boolean {
  return !state[id].c || max === id;
}

export function isV130ColumnCollapsed(
  column: V130LayoutColumn,
  state: V130PanelStateMap,
  max: V130PanelId | null,
): boolean {
  if (column.stack) {
    return !column.stack.some((id) =>
      isV130PanelOpen(state, id, max),
    );
  }

  return !isV130PanelOpen(
    state,
    column.id as V130PanelId,
    max,
  );
}

function deriveColumns(
  row: V130LayoutRow,
  state: V130PanelStateMap,
  max: V130PanelId | null,
) {
  const collapsed = row.cols.map((col) =>
    isV130ColumnCollapsed(
      col,
      state,
      max,
    ),
  );

  const docked = collapsed.every(Boolean);

  const growId =
    row.grow.find((id) => {
      const index = row.cols.findIndex(
        (col) => col.id === id,
      );

      return (
        index >= 0 &&
        !collapsed[index]
      );
    }) ?? null;

  const template = row.cols
    .map((col, index) => {
      if (collapsed[index]) {
        return col.rail;
      }

      if (
        growId &&
        col.id === growId
      ) {
        return V130_FILL;
      }

      return col.w;
    })
    .concat(
      !growId
        ? [V130_FILL]
        : [],
    )
    .join(' ');

  return {
    collapsed,
    docked,
    template,
  };
}

function deriveStackRows(
  col: V130LayoutColumn,
  state: V130PanelStateMap,
  max: V130PanelId | null,
): string {
  if (!col.stack || !col.rows) {
    return 'minmax(0,1fr)';
  }

  const [a, b] = col.stack.map(
    (id) =>
      state[id].c &&
      max !== id,
  );

  if (a && b) {
    return (
      'minmax(0,1fr) ' +
      'minmax(0,1fr)'
    );
  }

  if (a) {
    return '30px minmax(0,1fr)';
  }

  if (b) {
    return 'minmax(0,1fr) 30px';
  }

  return (
    `minmax(0,${col.rows[0]}) ` +
    col.rows[1]
  );
}

export function deriveV130Layout(
  inputState: V130PanelStateMap,
  max: V130PanelId | null,
): V130DerivedLayout {
  const state =
    cloneV130PanelState(
      inputState,
    );

  const main =
    deriveColumns(
      V130_LAYOUT.main,
      state,
      max,
    );

  const bottom =
    deriveColumns(
      V130_LAYOUT.bottom,
      state,
      max,
    );

  const right =
    V130_LAYOUT.main.cols[2];

  const left =
    V130_LAYOUT.bottom.cols[0];

  const allCollapsed =
    main.docked &&
    bottom.docked;

  let rows =
    V130_ROWS_DEFAULT;

  if (
    main.docked &&
    bottom.docked
  ) {
    rows =
      '58px 26px 40px minmax(0,1fr) 32px';
  } else if (
    main.docked
  ) {
    rows =
      '58px 26px 40px minmax(0,1fr) 32px';
  } else if (
    bottom.docked
  ) {
    rows =
      '58px 26px minmax(0,1fr) 42px 32px';
  }

  return {
    rows,
    mainCols: main.template,
    bottomCols: bottom.template,
    rightRows:
      deriveStackRows(
        right,
        state,
        max,
      ),
    leftRows:
      deriveStackRows(
        left,
        state,
        max,
      ),
    dockedMain:
      main.docked,
    dockedBottom:
      bottom.docked,
    allCollapsed,
  };
}

export function deriveV130PanelDelta(
  live: V130DesignSize | undefined,
  design: V130DesignSize | undefined,
): V130PanelDelta {
  if (!live || !design) {
    return {
      dw: 0,
      dh: 0,
    };
  }

  return {
    dw: Math.max(
      0,
      live.w - design.w,
    ),
    dh: Math.max(
      0,
      live.h - design.h,
    ),
  };
}

export function panelBelongsToMainRow(
  id: V130PanelId,
): boolean {
  return (
    id === 'side' ||
    id === 'arr' ||
    id === 'routing' ||
    id === 'takes'
  );
}

export function panelBelongsToBottomRow(
  id: V130PanelId,
): boolean {
  return !panelBelongsToMainRow(id);
}
