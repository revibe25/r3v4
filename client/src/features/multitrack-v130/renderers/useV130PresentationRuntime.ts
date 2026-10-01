import {
  useLayoutEffect,
  type RefObject,
} from 'react';

import { useDAWStore } from '@/hooks/useDAWStore';

import type { V130Viewport } from '../layout/v130-layout';
import type {
  V130CanvasRegistry,
  V130CanvasSurface,
} from './v130-canvas-registry';

const BARS = 48;
const BEATS = BARS * 4;
const TRACK_H = 48;

const COLORS: Record<string, string> = {
  '--status-warn': '#f5b83d',
  '--accent-green': '#a4f422',
  '--looper-cyan': '#2ee6f2',
  '--accent-violet': '#a15cff',
  '--looper-pink': '#e04bfa',
  '--text-dim': '#758187',
};

const FALLBACK_TRACK_COLORS = [
  '#f5b83d',
  '#ff6257',
  '#a4f422',
  '#2ee6f2',
  '#a15cff',
  '#e04bfa',
  '#758187',
];

function resolveColor(
  value: string,
  index = 0,
): string {
  const match = value.match(
    /var\((--[^),]+)\)/,
  );

  if (match) {
    return COLORS[match[1]] ??
      FALLBACK_TRACK_COLORS[index % FALLBACK_TRACK_COLORS.length];
  }

  return value || FALLBACK_TRACK_COLORS[index % FALLBACK_TRACK_COLORS.length];
}

function makeButton(
  className: string,
  text: string,
  aria: string,
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-label', aria);
  return el;
}

function surface(
  registry: V130CanvasRegistry,
  root: HTMLElement,
  id: string,
): V130CanvasSurface | null {
  const el = root.querySelector<HTMLCanvasElement>(id);
  return el ? registry.get(el) ?? null : null;
}

function drawTimeline(
  target: V130CanvasSurface,
  state: ReturnType<typeof useDAWStore.getState>,
  root: HTMLElement,
): void {
  const { ctx, w, h } = target;
  const d3 = root.querySelector('#arr')?.classList.contains('d3');
  const rowArea = Math.min(h, TRACK_H * 7 + 40);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#0a1317';
  ctx.fillRect(0, 0, w, 40);

  for (let bar = 0; bar <= BARS; bar++) {
    const x = Math.round(
      (bar / BARS) * w,
    ) + 0.5;

    ctx.strokeStyle =
      bar % 4 === 0
        ? '#1a2a31'
        : '#0e181d';

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rowArea);
    ctx.stroke();

    if (bar % 4 === 0 && bar < BARS) {
      ctx.fillStyle = '#7f98a1';
      ctx.font = '10px system-ui';
      ctx.fillText(
        String(bar + 1),
        x + 3,
        12,
      );
    }
  }

  const tracks = state.tracks.slice(0, 7);
  const regions = state.regions ?? [];

  for (let i = 0; i < 7; i++) {
    const y = 40 + i * TRACK_H;
    const selected =
      tracks[i]?.id === state.selectedTrackId;

    ctx.fillStyle = selected
      ? '#0c1a20'
      : i % 2
        ? '#070d10'
        : '#060b0e';

    ctx.fillRect(
      0,
      y,
      w,
      TRACK_H - 1,
    );

    const trackId = tracks[i]?.id;
    const trackColor = resolveColor(
      tracks[i]?.color ?? '',
      i,
    );

    for (const region of regions) {
      if (
        region.trackId !== trackId
      ) {
        continue;
      }

      const x0 = Math.max(
        0,
        (region.startBeat / BEATS) * w,
      );

      const x1 = Math.min(
        w,
        ((region.startBeat + region.lengthBeats) / BEATS) * w,
      );

      const width = Math.max(
        2,
        x1 - x0,
      );

      if (d3) {
        const grad =
          ctx.createLinearGradient(
            0,
            y + 2,
            0,
            y + TRACK_H - 6,
          );
        grad.addColorStop(
          0,
          `${trackColor}99`,
        );
        grad.addColorStop(
          0.5,
          `${trackColor}44`,
        );
        grad.addColorStop(
          1,
          '#030608',
        );

        ctx.fillStyle = '#00000099';
        ctx.fillRect(
          x0 + 3,
          y + 6,
          width,
          TRACK_H - 9,
        );

        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = `${trackColor}30`;
      }

      ctx.fillRect(
        x0 + 1,
        y + 3,
        width - 2,
        TRACK_H - 7,
      );

      ctx.strokeStyle = `${trackColor}aa`;
      ctx.strokeRect(
        x0 + 1.5,
        y + 3.5,
        Math.max(1, width - 3),
        TRACK_H - 8,
      );

      ctx.fillStyle = '#dbe8ec';
      ctx.font = '9px system-ui';
      ctx.fillText(
        region.label,
        Math.min(w - 70, x0 + 7),
        y + 15,
      );

      const seed =
        ((region.startBeat + i * 17) % 29) / 29;

      ctx.fillStyle = `${trackColor}cc`;

      for (
        let x = Math.ceil(x0 + 3);
        x < x1 - 3;
        x += 2
      ) {
        const wave =
          0.2 +
          0.8 *
            Math.abs(
              Math.sin(
                x * 0.31 +
                seed * 8,
              ),
            );

        const hh =
          wave * (TRACK_H * 0.27);

        ctx.fillRect(
          x,
          y + TRACK_H / 2 - hh,
          1,
          hh * 2,
        );
      }
    }
  }

  const playX =
    (Math.max(0, state.position) / BEATS) *
    w;

  ctx.strokeStyle = '#a4f422';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(playX + 0.5, 0);
  ctx.lineTo(playX + 0.5, rowArea);
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = '#a4f422';
  ctx.beginPath();
  ctx.moveTo(playX - 5, 2);
  ctx.lineTo(playX + 5, 2);
  ctx.lineTo(playX, 9);
  ctx.fill();

  const loopStart =
    Math.max(0, state.loopStart ?? 0);
  const loopEnd =
    Math.max(loopStart + 0.01, state.loopEnd ?? 16);

  if (state.loopEnabled) {
    const lx =
      (loopStart / BEATS) * w;
    const rx =
      (loopEnd / BEATS) * w;

    ctx.fillStyle = '#a4f42214';
    ctx.fillRect(
      lx,
      0,
      Math.max(1, rx - lx),
      22,
    );

    ctx.fillStyle = '#a4f422';
    ctx.fillRect(
      lx,
      0,
      2,
      22,
    );
    ctx.fillRect(
      Math.max(0, rx - 2),
      0,
      2,
      22,
    );
  }

  ctx.fillStyle = '#08110b';
  ctx.fillRect(
    0,
    40 + TRACK_H * 7,
    w,
    Math.max(0, h - (40 + TRACK_H * 7)),
  );

  ctx.strokeStyle = '#1b2e16';
  ctx.beginPath();
  ctx.moveTo(
    0,
    40 + TRACK_H * 7 + 0.5,
  );
  ctx.lineTo(
    w,
    40 + TRACK_H * 7 + 0.5,
  );
  ctx.stroke();

  ctx.fillStyle = '#84cc16';
  ctx.font = '9px system-ui';
  ctx.fillText(
    'AUTOMATION · Pad filter cutoff',
    8,
    40 + TRACK_H * 7 + 18,
  );

  ctx.strokeStyle = '#84cc16';
  ctx.beginPath();

  for (let x = 0; x <= w; x += Math.max(8, w / 12)) {
    const y =
      40 +
      TRACK_H * 7 +
      30 +
      Math.sin(x * 0.012) * 7;

    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function drawOverlay(
  target: V130CanvasSurface,
  state: ReturnType<typeof useDAWStore.getState>,
): void {
  const { ctx, w, h } = target;

  ctx.clearRect(0, 0, w, h);

  if (
    state.loopEnabled ||
    state.loopEnd > state.loopStart
  ) {
    const x0 =
      (Math.max(0, state.loopStart) / BEATS) * w;
    const x1 =
      (Math.max(state.loopStart + 0.01, state.loopEnd) / BEATS) * w;

    ctx.fillStyle = state.loopEnabled
      ? '#a4f42218'
      : '#ffffff08';

    ctx.fillRect(
      x0,
      0,
      Math.max(1, x1 - x0),
      22,
    );
  }

  const x =
    (Math.max(0, state.position) / BEATS) * w;

  const col =
    state.recording
      ? '#ff6257'
      : '#a4f422';

  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 0);
  ctx.lineTo(x + 0.5, h);
  ctx.stroke();
}

function drawAnalyzer(
  target: V130CanvasSurface,
  state: ReturnType<typeof useDAWStore.getState>,
): void {
  const { ctx, w, h } = target;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 7; i++) {
    const y =
      8 + (i / 6) * Math.max(10, h - 18);

    ctx.strokeStyle = '#122027';
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const x =
      18 + (i / 8) * Math.max(1, w - 24);

    ctx.strokeStyle = '#0e181d';
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x, h - 6);
    ctx.stroke();
  }

  ctx.strokeStyle = '#2ee6f2';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const gain =
    state.masterGain > 0
      ? state.masterGain
      : 0.2;

  for (let x = 18; x < w; x++) {
    const base =
      h -
      12 -
      gain *
        (0.15 + 0.6 *
          Math.abs(
            Math.sin(
              x * 0.055 +
              state.position * 0.08,
            ),
          )) *
        (h - 24);

    const y =
      state.playing
        ? base
        : h - 28 -
          10 *
            Math.abs(
              Math.sin(x * 0.028),
            );

    if (x === 18) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = '#7f98a1';
  ctx.font = '9px system-ui';

  for (const [i, label] of [
    '50',
    '100',
    '200',
    '500',
    '1k',
    '2k',
    '5k',
    '10k',
  ].entries()) {
    ctx.fillText(
      label,
      22 + (i / 7) * Math.max(1, w - 42),
      h - 3,
    );
  }
}

function drawMasterMeter(
  target: V130CanvasSurface,
  state: ReturnType<typeof useDAWStore.getState>,
): void {
  const { ctx, w, h } = target;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060b0e';
  ctx.fillRect(0, 0, w, h);

  const level =
    Math.max(
      0,
      Math.min(
        1,
        (state.masterGain ?? 0.8) /
          1.2,
      ),
    );

  const y0 =
    h - 8;
  const y1 =
    Math.max(
      8,
      y0 - level * (h - 16),
    );

  const grad =
    ctx.createLinearGradient(
      0,
      y0,
      0,
      y1,
    );

  grad.addColorStop(
    0,
    '#2ee6f2',
  );
  grad.addColorStop(
    0.7,
    '#a4f422',
  );
  grad.addColorStop(
    1,
    '#ff6257',
  );

  ctx.fillStyle = grad;
  ctx.fillRect(
    12,
    y1,
    Math.max(6, w - 24),
    y0 - y1,
  );

  ctx.strokeStyle = '#24343b';
  ctx.strokeRect(
    10.5,
    8.5,
    Math.max(8, w - 21),
    Math.max(12, h - 17),
  );

  ctx.fillStyle = '#7f98a1';
  ctx.font = '8px system-ui';

  for (let i = 0; i <= 5; i++) {
    const y =
      10 +
      (i / 5) * Math.max(1, h - 20);

    ctx.fillRect(
      4,
      y,
      4,
      1,
    );
  }
}

function ensureModes(
  root: HTMLElement,
): void {
  const modes = root.querySelector<HTMLElement>('#modes');
  if (!modes || modes.children.length) {
    return;
  }

  for (const [id, label] of [
    ['arrange', 'ARRANGE'],
    ['mix', 'MIX'],
    ['edit', 'EDIT'],
    ['automation', 'AUTOMATION'],
    ['midi', 'MIDI'],
    ['vox', 'VOX'],
    ['master', 'MASTER'],
  ]) {
    const b = makeButton(
      '',
      label,
      label,
    );
    b.dataset.m = id;
    b.setAttribute(
      'aria-pressed',
      id === 'arrange' ? 'true' : 'false',
    );
    modes.append(b);
  }

  modes.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      modes.querySelectorAll('button').forEach((x) =>
        x.setAttribute(
          'aria-pressed',
          String(x === b),
        ),
      );

      root
        .querySelectorAll<HTMLElement>('[data-m]')
        .forEach((panel) => {
          if (
            panel === modes ||
            !panel.id
          ) {
            return;
          }

          const modesForPanel =
            panel.dataset.m?.split(/\s+/) ?? [];

          panel.classList.toggle(
            'focus',
            modesForPanel.includes(
              b.dataset.m ?? '',
            ),
          );
        });
    });
  });
}

function ensureNav(
  root: HTMLElement,
): void {
  const nav = root.querySelector<HTMLElement>('#nav');
  if (!nav || nav.children.length) {
    return;
  }

  for (const [label, mode] of [
    ['Session', 'arrange'],
    ['Media', 'vox'],
    ['Plugins', 'master'],
    ['Routing', 'mix'],
    ['Automation', 'automation'],
    ['MIDI', 'midi'],
    ['Library', 'midi'],
    ['Settings', 'settings'],
  ]) {
    const b = makeButton(
      '',
      label,
      label,
    );

    b.dataset.m = mode;

    b.addEventListener('click', () => {
      nav
        .querySelectorAll('button')
        .forEach((x) =>
          x.removeAttribute('aria-current'),
        );

      b.setAttribute(
        'aria-current',
        'true',
      );
    });

    nav.append(b);
  }
}

function ensureTracks(
  root: HTMLElement,
): void {
  const box =
    root.querySelector<HTMLElement>('#trows');

  if (!box || box.children.length) {
    return;
  }

  const state =
    useDAWStore.getState();

  state.tracks
    .slice(0, 7)
    .forEach((track, index) => {
      const row =
        document.createElement('div');

      row.className = 'trow';
      row.dataset.i = String(index);
      row.style.setProperty(
        '--c',
        track.color,
      );

      row.innerHTML =
        `<div class="cb"></div>` +
        `<div class="ic">${track.type === 'audio' ? '●' : track.type === 'midi' ? '◆' : '◇'}</div>` +
        `<div class="bd">` +
        `<div class="l1"><b>${track.label}</b>` +
        `<button class="msr m" aria-label="Mute ${track.label}">M</button>` +
        `<button class="msr s" aria-label="Solo ${track.label}">S</button>` +
        `<button class="msr r" aria-label="Arm ${track.label}">R</button>` +
        `<span class="hm"><i></i></span></div>` +
        `<div class="l2"><small>${track.type}</small>` +
        `<select class="is" aria-label="${track.label} input">` +
        `<option>In: all</option><option>In: pads/keys</option><option>In: MIDI</option><option>In: off</option>` +
        `</select>` +
        `<select class="bs" aria-label="${track.label} output">` +
        `<option>Main</option><option>Music Bus</option><option>Drum Bus</option><option>No output</option>` +
        `</select></div></div>`;

      row.addEventListener('click', (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('button,select')
        ) {
          return;
        }

        useDAWStore
          .getState()
          .setSelectedTrack(track.id);
      });

      box.append(row);
    });
}

function ensureMixer(
  root: HTMLElement,
): void {
  const box =
    root.querySelector<HTMLElement>('#strips');

  if (!box || box.children.length) {
    return;
  }

  useDAWStore
    .getState()
    .tracks
    .slice(0, 7)
    .forEach((track, index) => {
      const strip =
        document.createElement('div');

      strip.className = 'strip';
      strip.dataset.i = String(index);
      strip.style.setProperty(
        '--c',
        track.color,
      );

      strip.innerHTML =
        `<div class="nm">${track.label}</div>` +
        `<div class="ms">` +
        `<button class="msr m">M</button>` +
        `<button class="msr s">S</button>` +
        `</div>` +
        `<div class="vmet"><i></i></div>` +
        `<div class="kn">${Math.round(track.gain * 100)}</div>` +
        `<div class="fader"><i></i></div>` +
        `<div class="db">${(20 * Math.log10(Math.max(track.gain, 0.001))).toFixed(1)} dB</div>`;

      strip
        .querySelector('.nm')
        ?.addEventListener('click', () => {
          useDAWStore
            .getState()
            .setSelectedTrack(track.id);
        });

      box.append(strip);
    });

  const master =
    document.createElement('div');

  master.className = 'strip master';
  master.innerHTML =
    `<div class="nm">MASTER</div>` +
    `<div class="vmet"><i></i></div>` +
    `<div class="fader"><i></i></div>` +
    `<div class="db">${useDAWStore.getState().masterGain.toFixed(2)}</div>`;

  box.append(master);
}

function ensurePads(
  root: HTMLElement,
): void {
  const pads =
    root.querySelector<HTMLElement>('#pads');

  if (pads && !pads.children.length) {
    for (let i = 0; i < 16; i++) {
      const p =
        makeButton(
          'pad',
          '',
          `Pad ${i + 1}`,
        );

      p.style.setProperty(
        '--pc',
        FALLBACK_TRACK_COLORS[
          i % FALLBACK_TRACK_COLORS.length
        ],
      );

      p.addEventListener('pointerdown', () => {
        p.classList.add('on');
      });

      p.addEventListener('pointerup', () => {
        p.classList.remove('on');
      });

      p.addEventListener('pointerleave', () => {
        p.classList.remove('on');
      });

      pads.append(p);
    }
  }

  const banks =
    root.querySelector<HTMLElement>('#banks');

  if (banks && !banks.children.length) {
    for (const [index, label] of ['A', 'B', 'C', 'D'].entries()) {
      const b =
        makeButton(
          '',
          label,
          `Bank ${label}`,
        );

      b.dataset.k = String(index);
      b.setAttribute(
        'aria-pressed',
        index === 0 ? 'true' : 'false',
      );

      b.addEventListener('click', () => {
        banks.querySelectorAll('button').forEach((x) =>
          x.setAttribute(
            'aria-pressed',
            String(x === b),
          ),
        );
      });

      banks.append(b);
    }
  }
}

function ensurePiano(
  root: HTMLElement,
): void {
  const piano =
    root.querySelector<HTMLElement>('#piano');

  if (!piano || piano.children.length) {
    return;
  }

  for (let midi = 48; midi <= 72; midi++) {
    const black =
      [1, 3, 6, 8, 10].includes(
        midi % 12,
      );

    const key =
      document.createElement('div');

    key.className =
      black ? 'bk' : 'wk';

    key.dataset.m = String(midi);
    key.setAttribute(
      'aria-label',
      `MIDI ${midi}`,
    );

    key.addEventListener('pointerdown', () => {
      key.classList.add('on');
    });

    key.addEventListener('pointerup', () => {
      key.classList.remove('on');
    });

    piano.append(key);
  }
}

function ensureTakes(
  root: HTMLElement,
): void {
  const box =
    root.querySelector<HTMLElement>('#tklist');

  if (!box || box.children.length) {
    return;
  }

  for (let i = 0; i < 4; i++) {
    const row =
      document.createElement('div');

    row.className = 'take';
    row.setAttribute(
      'aria-pressed',
      i === 0 ? 'true' : 'false',
    );

    row.innerHTML =
      `<span>Take ${i + 1}</span>` +
      `<small>${i === 0 ? 'Selected' : 'Alternate'}</small>`;

    box.append(row);
  }
}

function ensureRouting(
  root: HTMLElement,
): void {
  const svg =
    root.querySelector<SVGElement>('#rsvg');

  if (!svg || svg.childNodes.length) {
    return;
  }

  svg.setAttribute(
    'viewBox',
    '0 0 282 138',
  );

  const ns =
    'http://www.w3.org/2000/svg';

  const lines =
    [
      [14, 18, 110, 18],
      [14, 49, 110, 49],
      [14, 80, 110, 80],
      [14, 111, 110, 111],
      [110, 18, 190, 49],
      [110, 49, 190, 80],
      [110, 80, 190, 111],
    ];

  for (const [x1, y1, x2, y2] of lines) {
    const line =
      document.createElementNS(ns, 'line');

    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute(
      'stroke',
      '#2ee6f2',
    );
    line.setAttribute(
      'stroke-opacity',
      '0.55',
    );

    svg.append(line);
  }
}


type V130BusId = 'drum' | 'music' | 'vocal' | 'fx' | 'none';

type V130SendRow = {
  id: string;
  from: string;
  to: string;
  value: number;
};

const V130_BUSES: ReadonlyArray<{ id: Exclude<V130BusId, 'none'>; name: string }> = [
  { id: 'drum', name: 'Drum Bus' },
  { id: 'music', name: 'Music Bus' },
  { id: 'vocal', name: 'Vocal Bus' },
  { id: 'fx', name: 'FX Bus' },
];

const V130_DEFAULT_BUSES: V130BusId[] = [
  'drum',
  'music',
  'music',
  'music',
  'music',
  'vocal',
  'fx',
];

const V130_SENDS_KEY = 'r3n.v130.routing.sends.v1';
const V130_BUS_KEY = 'r3n.v130.routing.buses.v1';

const V130_DEFAULT_SENDS: V130SendRow[] = [
  { id: 'voxRev', from: 'Vox', to: 'Reverb', value: -12.3 },
  { id: 'voxDly', from: 'Vox', to: 'Delay', value: -15.6 },
  { id: 'drumRoom', from: 'Drum Bus', to: 'Room', value: -18.0 },
  { id: 'musicPc', from: 'Music Bus', to: 'Parallel comp', value: -20.0 },
];

function readV130Routing<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeV130Routing<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* UI remains usable when storage is unavailable. */
  }
}

function ensureRoutingPane(
  root: HTMLElement,
): void {
  const pane = root.querySelector<HTMLElement>('#rpane');
  const sendsTab = root.querySelector<HTMLButtonElement>('#tabS');
  const matrixTab = root.querySelector<HTMLButtonElement>('#tabM');
  const valid = root.querySelector<HTMLElement>('#rValid');
  const footer = root.querySelector<HTMLElement>('#fRt');

  if (!pane || !sendsTab || !matrixTab) {
    return;
  }

  const state = {
    tab: 'sends' as 'sends' | 'mtx',
    buses: readV130Routing<V130BusId[]>(
      V130_BUS_KEY,
      [...V130_DEFAULT_BUSES],
    ),
    sends: readV130Routing<V130SendRow[]>(
      V130_SENDS_KEY,
      V130_DEFAULT_SENDS.map((row) => ({ ...row })),
    ),
  };

  const setRoutingStatus = () => {
    const validState =
      state.buses.slice(0, 7).every((bus) => bus !== 'none');

    if (valid) {
      valid.textContent = validState ? 'Valid' : 'Check';
      valid.style.color =
        validState ? 'var(--ac)' : 'var(--warn)';
    }

    if (footer) {
      footer.textContent =
        validState ? 'Routing: valid' : 'Routing: check';
      footer.classList.toggle('ok', validState);
      footer.classList.toggle('wn', !validState);
    }
  };

  const render = () => {
    sendsTab.setAttribute(
      'aria-pressed',
      String(state.tab === 'sends'),
    );

    matrixTab.setAttribute(
      'aria-pressed',
      String(state.tab === 'mtx'),
    );

    if (state.tab === 'sends') {
      const wrap = document.createElement('div');
      wrap.className = 'sends';

      for (const row of state.sends) {
        const line = document.createElement('div');
        line.className = 'srow';

        const label = document.createElement('span');
        label.innerHTML =
          `${row.from} <i>→</i> ${row.to}`;

        const input =
          document.createElement('input');

        input.type = 'range';
        input.min = '-60';
        input.max = '0';
        input.step = '0.1';
        input.value = String(row.value);
        input.setAttribute(
          'aria-label',
          `${row.from} to ${row.to} send`,
        );

        const output =
          document.createElement('output');

        output.className = 'num';

        const sync = () => {
          input.value = String(row.value);
          input.style.setProperty(
            '--v',
            `${((row.value + 60) / 60) * 100}%`,
          );
          output.textContent =
            `${row.value.toFixed(1)} dB`;
        };

        input.addEventListener('input', () => {
          row.value = Number(input.value);
          writeV130Routing(V130_SENDS_KEY, state.sends);
          sync();
        });

        sync();
        line.append(label, input, output);
        wrap.append(line);
      }

      pane.replaceChildren(wrap);
    } else {
      const table =
        document.createElement('table');

      table.className = 'mtx';

      const head =
        document.createElement('tr');

      const blank =
        document.createElement('th');

      head.append(blank);

      for (const bus of V130_BUSES) {
        const th =
          document.createElement('th');

        th.textContent =
          bus.name.replace(' Bus', '');

        head.append(th);
      }

      const none =
        document.createElement('th');

      none.textContent = 'None';
      head.append(none);

      table.append(head);

      const tracks =
        useDAWStore.getState().tracks.slice(0, 7);

      for (let i = 0; i < 7; i++) {
        const row =
          document.createElement('tr');

        const label =
          document.createElement('td');

        label.textContent =
          tracks[i]?.label ??
          `Track ${i + 1}`;

        row.append(label);

        for (const bus of [
          ...V130_BUSES.map((item) => item.id),
          'none' as const,
        ]) {
          const cell =
            document.createElement('td');

          const button =
            makeButton(
              '',
              '',
              `${label.textContent} to ${
                bus === 'none'
                  ? 'None'
                  : V130_BUSES.find((item) => item.id === bus)?.name ?? bus
              }`,
            );

          button.dataset.i = String(i);
          button.dataset.b = bus;
          button.setAttribute(
            'aria-pressed',
            String(state.buses[i] === bus),
          );

          button.addEventListener('click', () => {
            state.buses[i] = bus;
            writeV130Routing(V130_BUS_KEY, state.buses);
            render();
            setRoutingStatus();
          });

          cell.append(button);
          row.append(cell);
        }

        table.append(row);
      }

      pane.replaceChildren(table);
    }

    setRoutingStatus();
  };

  sendsTab.onclick = () => {
    state.tab = 'sends';
    render();
  };

  matrixTab.onclick = () => {
    state.tab = 'mtx';
    render();
  };

  render();
}

function ensureAnalysisTabs(
  root: HTMLElement,
): void {
  const tabs =
    root.querySelector<HTMLElement>('#aTabs');

  if (!tabs || tabs.children.length) {
    return;
  }

  for (const [id, label] of [
    ['spec', 'Spectrum'],
    ['lufs', 'LUFS'],
    ['phase', 'Phase'],
    ['wid', 'Stereo'],
    ['rms', 'RMS'],
  ]) {
    const b =
      makeButton(
        '',
        label,
        label,
      );

    b.dataset.k = id;

    b.setAttribute(
      'aria-pressed',
      id === 'spec' ? 'true' : 'false',
    );

    b.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((x) =>
        x.setAttribute(
          'aria-pressed',
          String(x === b),
        ),
      );
    });

    tabs.append(b);
  }
}

function ensureDspEditor(
  root: HTMLElement,
): void {
  const editor =
    root.querySelector<HTMLElement>('#dspEd');

  if (!editor || editor.children.length) {
    return;
  }

  editor.innerHTML =
    `<div class="dev"><b>MASTER</b><span>Professional bus processing</span></div>` +
    `<div class="dev"><span>R3 Compressor</span><span>0.0 dB GR</span></div>` +
    `<div class="dev"><span>R3 Limiter</span><span>-1.0 dB ceiling</span></div>`;
}

function syncDom(
  root: HTMLElement,
): void {
  const state =
    useDAWStore.getState();

  root
    .querySelectorAll<HTMLElement>('.trow')
    .forEach((row) => {
      const i =
        Number(row.dataset.i ?? -1);
      const track =
        state.tracks[i];

      if (!track) {
        return;
      }

      row.classList.toggle(
        'sel',
        track.id === state.selectedTrackId,
      );

      row.classList.toggle(
        'mute',
        track.mute,
      );

      row.classList.toggle(
        'solo',
        track.solo,
      );

      const arm =
        row.querySelector<HTMLElement>('.r');

      arm?.classList.toggle(
        'on',
        track.armed,
      );

      const meter =
        row.querySelector<HTMLElement>('.hm i');

      if (meter) {
        meter.style.transform =
          `scaleX(${Math.max(0.03, Math.min(1, track.gain))})`;
      }
    });

  root
    .querySelectorAll<HTMLElement>('.strip')
    .forEach((strip) => {
      const i =
        Number(strip.dataset.i ?? -1);

      const track =
        state.tracks[i];

      if (!track) {
        return;
      }

      strip.classList.toggle(
        'sel',
        track.id === state.selectedTrackId,
      );

      const meter =
        strip.querySelector<HTMLElement>('.vmet i');

      if (meter) {
        meter.style.transform =
          `scaleY(${Math.max(0.03, Math.min(1, track.gain))})`;
      }

      const fader =
        strip.querySelector<HTMLElement>('.fader i');

      if (fader) {
        fader.style.transform =
          `scaleY(${Math.max(0.03, Math.min(1, track.gain))})`;
      }
    });

  const saved =
    root.querySelector('#pSaved');

  if (saved) {
    saved.textContent =
      state.lastSavedAt
        ? new Date(state.lastSavedAt).toLocaleTimeString()
        : 'never';
  }
}

export function useV130PresentationRuntime(
  rootRef: RefObject<HTMLElement | null>,
  viewport: V130Viewport,
  registry: V130CanvasRegistry,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    ensureModes(root);
    ensureNav(root);
    ensureTracks(root);
    ensureMixer(root);
    ensurePads(root);
    ensurePiano(root);
    ensureTakes(root);
    ensureRouting(root);
    ensureRoutingPane(root);
    ensureAnalysisTabs(root);
    ensureDspEditor(root);
    syncDom(root);

    let raf = 0;
    let disposed = false;

    const frame = () => {
      if (disposed) {
        return;
      }

      const state =
        useDAWStore.getState();

      registry.sizeCanvases(
        viewport.scale,
      );

      const staticSurface =
        surface(
          registry,
          root,
          '#cvS',
        );

      const overlaySurface =
        surface(
          registry,
          root,
          '#cvO',
        );

      const analyzerSurface =
        surface(
          registry,
          root,
          '#cvA',
        );

      const meterSurface =
        surface(
          registry,
          root,
          '#cvM',
        );

      if (staticSurface) {
        drawTimeline(
          staticSurface,
          state,
          root,
        );
      }

      if (overlaySurface) {
        drawOverlay(
          overlaySurface,
          state,
        );
      }

      if (analyzerSurface) {
        drawAnalyzer(
          analyzerSurface,
          state,
        );
      }

      if (meterSurface) {
        drawMasterMeter(
          meterSurface,
          state,
        );
      }

      syncDom(root);

      raf =
        window.requestAnimationFrame(frame);
    };

    const unsubscribe =
      useDAWStore.subscribe(() => {});

    const observer =
      new ResizeObserver(() => {
        registry.sizeCanvases(
          viewport.scale,
        );
      });

    observer.observe(root);

    raf =
      window.requestAnimationFrame(frame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      unsubscribe();
      observer.disconnect();
    };
  }, [
    rootRef,
    viewport.scale,
    registry,
  ]);
}
