# R3 NATIVE Multitrack v1.3.0 — Reference Source Map

- SHA256: `b38da47b26317782f54fad381925379f203760e4193419aa7d050bd271c2e9b0`
- Bytes: `194850`
- Lines: `42`

## Section boundaries

```text
1946:/* ===== 01 core ===== */
2030:/* ===== 02 canvas — Canvas 2D surfaces and renderers (2D + 3D) =====
2847:/* ===== 03 sidebar — icons, nav, menu bar, pad controller, keyboard ===== */
3206:/* ===== 04 data — the single source of truth for audio AND drawing =====
3832:/* ===== 05 mixer — controls, track headers, channel strips, meters ===== */
4179:/* ===== 06 dsp — DSP component library =====
4650:/* ===== 07 engine — voices, graph, scheduler, transport, MIDI, analysis, render ===== */
5587:/* ===== 08 panels — fluid layout, collapse / expand / maximize, 2D↔3D per panel =====
5966:/* ===== 09 app — routing + takes + DSP rack UI, dialogs, keyboard, boot ===== */
```

## Geometry

```text
5595:const DESIGN_W = 1536,
5596:  DESIGN_H = 1024;
5597:const ROWS_DEFAULT = '58px 26px minmax(0,474fr) minmax(0,434fr) 32px';
5598:const FILL = 'minmax(0,1fr)';
5640:const PANEL_IDS = ['side', 'arr', 'routing', 'takes', 'padsP', 'pianoP', 'mixer', 'dsp', 'ana'];
```

## Audio / MIDI / persistence ownership

```text
5104:      E.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: S.latency });
4515:const VZ = new OfflineAudioContext(1, 128, 48000);
5483:      oc = new OfflineAudioContext(4, len, sr),
5267:  if (!navigator.requestMIDIAccess) {
5272:  navigator.requestMIDIAccess().then(
5278:          inp.onmidimessage = (ev) => {
5106:      E.ctx.onstatechange = updEngine;
5291:      acc.onstatechange = bind;
5664:      const raw = localStorage.getItem('r3n.ui.v1');
5676:      localStorage.setItem('r3n.ui.v1', JSON.stringify(S.ui.panels));
```

## Transport functions

```text
5101:function ensureEngine() {
5124:function scheduleStep(g, step, t) {
5151:function pump() {
5164:function play() {
5180:function pause() {
5190:function stop() {
5194:function seek(step) {
5226:function updatePos() {
5207:function toggleRec() {
5216:function syncTransport() {
5221:function jumpMarker(dir) {
```

## Renderer functions

```text
2038:function backing(o) {
2045:function mkCanvas(el, w, hh) {
2054:function resizeSurface(o, w, hh) {
2066:function sizeCanvases() {
2076:function lp(e, o) {
2172:function drawStatic() {
2267:function drawPadNotes(c, a, b, y, col, d3) {
2287:function drawWave(c, i, x0, x1, y, col, d3) {
2323:function drawAutomation(c, d3) {
2363:function drawOverlay() {
2405:function drawTakes() {
2467:function drawAnalyzer() {
2712:function drawMasterMeter(vl, vr) {
2761:function drawViz() {
4153:function drawMeters() {
5468:async function render(opts = {}) {
```

## Data declarations

```text
3212:const SONG_BARS = 48,
3215:const SESSION = {
3367:const TRACKS = SESSION.tracks;
3368:const BUSES = SESSION.buses;
3369:const MARKERS = SESSION.markers;
3370:const CLIPS = TRACKS.map((t) => t.clips);
3371:const TAKES = SESSION.takes;
3372:const CH = SESSION.chords;
3373:const SYN = SESSION.synthGate;
3374:const REV0 = Object.fromEntries(TRACKS.map((t) => [t.id, t.rev]));
3375:const MIX_TRIM = -12.5; /* headroom trim at the mix-bus input (gain staging for the master chain) */
3062:const SCALE = [0, 2, 3, 5, 7, 8, 10];
3429:const DSP_DEF = JSON.parse(JSON.stringify(S.dsp));
3430:const VOX_DEF = { ...S.vox, rev: -12.3, dly: -15.6, room: -60 };
3431:const AUTO_DEF = JSON.parse(JSON.stringify(S.auto));
3504:const SENDROWS = [
```

## Public controller

```javascript
window.R3Multitrack = Object.freeze({
  state: S,
  data: Data,
  history: History,
  panels: Panels,
  dsp: DSP_LIB,
  play,
  pause,
  stop,
  seek,
  render,
  setMode,
  padHit,
  setTake: (k) => Data.setTake(k),
  get engine() {
    return E;
  },
});
```
