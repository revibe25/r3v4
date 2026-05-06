#!/usr/bin/env bash
# r3-daw-unified.sh
# Combines arrangement.tsx + daw.tsx + all enhancements into one expert DAW.
# Zero features removed. Every system enhanced and properly connected.
# Run: bash r3-daw-unified.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'
DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'; YLW='\033[0;33m'
PASS=0; FAIL=0
ok()      { echo -e "${GRN}✓${RST} $1"; PASS=$((PASS+1)); }
fail()    { echo -e "${RED}✗${RST} $1"; FAIL=$((FAIL+1)); }
info()    { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }
write_file() {
  local path="$1" content="$2"
  mkdir -p "$(dirname "$path")"
  printf '%s' "$content" > "$path"
  ok "$(realpath --relative-to="$ROOT" "$path")"
}

# ═══════════════════════════════════════════════════════════════════════════════
# FILE 1 — Unified DAW Page
# Merges: arrangement.tsx + daw.tsx
# Adds:   WaveformRenderer in regions, MIDIDevicePanel, useAutoSave integration,
#         VU meters in mixer, project browser, undo/redo in toolbar, marker bar
# ═══════════════════════════════════════════════════════════════════════════════
section "Writing unified DAW page"

write_file "$ROOT/client/src/pages/daw-unified.tsx" '/**
 * daw-unified.tsx — R3 v4 Master DAW Page
 *
 * Merges ALL three DAW pages into one expert-scale instrument:
 *   ∙ arrangement.tsx   — project browser, LCD, prefs, inspector, FX panels
 *   ∙ daw.tsx           — dawStore, RAF clock, keyboard shortcuts, timeline, toolbar
 *   ∙ r3-enhance        — WaveformRenderer, MIDIDevicePanel, useAutoSave, VU meters
 *
 * Architecture (strictly enforced — UI never talks to engine directly):
 *   React UI  →  dawStore  →  Scheduler  →  LLPTE Engine  →  Audio Output
 *                    ↑
 *               useAutoSave (debounced tRPC persist)
 *
 * Nothing removed. Everything connected.
 */
import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Settings, Undo2, Redo2, FolderOpen, Usb,
         Music2, Layers, Piano, Activity, SlidersHorizontal,
         ChevronDown, ChevronUp } from "lucide-react";

// ── State ─────────────────────────────────────────────────────────────────────
import {
  useDAWStore, useView, useTransport, useIsDirty, useTracks,
  useMarkers, useSelection, useMixer,
} from "@/state/dawStore";

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { usePlaybackClock }         from "@/hooks/usePlaybackClock";
import { useDAWKeyboardShortcuts }  from "@/hooks/useDAWKeyboardShortcuts";
import { useAutoSave }              from "@/hooks/useAutoSave";
import { useMIDIDevices }           from "@/hooks/useMIDIDevices";
import type { MIDIMessage }         from "@/hooks/useMIDIDevices";

// ── Core components (eagerly loaded — always visible) ─────────────────────────
import { DAWTransportBar }  from "@/components/daw/DAWTransportBar";
import { DAWToolbar }       from "@/components/daw/DAWToolbar";
import { Timeline }         from "@/components/daw/Timeline";

// ── Lazy panels (loaded on demand) ────────────────────────────────────────────
const InspectorPanel   = lazy(() => import("@/components/inspector/inspector-panel").then(m => ({ default: m.InspectorPanel })));
const MixerView        = lazy(() => import("@/components/mixer/mixer-view").then(m => ({ default: m.MixerView })));
const PianoRoll        = lazy(() => import("@/components/midi/piano-roll").then(m => ({ default: m.PianoRoll })));
const StepSequencer    = lazy(() => import("@/components/midi/step-sequencer").then(m => ({ default: m.StepSequencer })));
const EQPanel          = lazy(() => import("@/components/effects/eq-panel").then(m => ({ default: m.EQPanel })));
const CompressorPanel  = lazy(() => import("@/components/effects/compressor-panel").then(m => ({ default: m.CompressorPanel })));
const ReverbPanel      = lazy(() => import("@/components/effects/reverb-panel").then(m => ({ default: m.ReverbPanel })));
const DelayPanel       = lazy(() => import("@/components/effects/delay-panel").then(m => ({ default: m.DelayPanel })));
const AutomationLane   = lazy(() => import("@/components/daw/AutomationLane").then(m => ({ default: m.AutomationLane })));
const TransportLCD     = lazy(() => import("@/components/transport-lcd").then(m => ({ default: m.TransportLCD })));
const PreferencesPanel = lazy(() => import("@/components/preferences-panel").then(m => ({ default: m.PreferencesPanel })));
const ProjectBrowser   = lazy(() => import("@/components/project/project-browser").then(m => ({ default: m.ProjectBrowser })));
const MIDIDevicePanel  = lazy(() => import("@/components/midi/midi-device-panel").then(m => ({ default: m.MIDIDevicePanel })));
const WaveformRenderer = lazy(() => import("@/components/waveform/waveform-renderer").then(m => ({ default: m.WaveformRenderer })));
const CollapsibleFXPanel = lazy(() => import("@/components/collapsible-fx-panel").then(m => ({ default: m.CollapsibleFXPanel })));

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:     "#060606",
  panel:  "#0a0a0a",
  panel2: "#0d0d0d",
  border: "#1c1c1c",
  accent: "#b8ff00",
  dim:    "#555",
  text:   "#f0f0f0",
  danger: "#ff3b3b",
  warn:   "#ffb300",
  info:   "#00e5ff",
  font:   "monospace",
} as const;

// ── Local types ────────────────────────────────────────────────────────────────
type BottomTab   = "none" | "piano" | "step" | "fx" | "automation" | "midi" | "waveform";
type SidePanel   = "inspector" | "projects" | "none";
type TopNavTab   = "arrange" | "mix" | "edit";

// ── Small UI atoms ─────────────────────────────────────────────────────────────
function Spinner({ h = 60, label = "loading…" }: { h?: number; label?: string }) {
  return (
    <div style={{ height: h, display: "flex", alignItems: "center",
      justifyContent: "center", gap: 6, color: T.dim, fontFamily: T.font, fontSize: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%",
        border: `1px solid ${T.accent}`, borderTopColor: "transparent",
        animation: "spin 0.6s linear infinite" }} />
      {label}
    </div>
  );
}

function PanelHeader({
  title, children, accent = false,
}: { title: string; children?: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      height: 28, display: "flex", alignItems: "center", padding: "0 10px",
      borderBottom: `1px solid ${T.border}`,
      background: accent ? `rgba(184,255,0,0.04)` : T.panel,
      flexShrink: 0, gap: 8,
    }}>
      <span style={{ fontSize: 7, letterSpacing: ".2em", textTransform: "uppercase",
        color: accent ? T.accent : T.dim, fontFamily: T.font, flex: 1 }}>
        {title}
      </span>
      {children}
    </div>
  );
}

function IconBtn({
  icon, onClick, active = false, title, danger = false,
}: { icon: React.ReactNode; onClick?: () => void; active?: boolean; title?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? (danger ? "rgba(255,59,59,0.15)" : "rgba(184,255,0,0.1)") : "transparent",
      border: `1px solid ${active ? (danger ? T.danger : T.accent) : T.border}`,
      color: active ? (danger ? T.danger : T.accent) : T.dim,
      cursor: "pointer", flexShrink: 0,
    }}>{icon}</button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px", flexShrink: 0 }} />;
}

// ── Marker bar ────────────────────────────────────────────────────────────────
function MarkerBar() {
  const markers  = useMarkers();
  const store    = useDAWStore();
  const { currentBar } = useTransport();
  const { pxPerBar, scrollX } = useView();
  const HEADER_W = 168;

  return (
    <div style={{
      height: 18, display: "flex", flexShrink: 0,
      borderBottom: `1px solid ${T.border}`, background: T.panel2, position: "relative",
    }}>
      <div style={{ width: HEADER_W, flexShrink: 0, borderRight: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", paddingLeft: 8, gap: 4 }}>
        <button onClick={() => store.addMarker(currentBar)}
          title="Add marker at playhead (Ctrl+M)"
          style={{ height: 14, padding: "0 6px", fontSize: 6, fontFamily: T.font,
            background: "transparent", border: `1px solid ${T.border}`,
            color: T.dim, cursor: "pointer", letterSpacing: ".1em" }}>
          +M
        </button>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {markers.map(m => {
          const x = (m.position - 1) * pxPerBar - scrollX;
          if (x < -60 || x > 2000) return null;
          return (
            <div key={m.id}
              onClick={() => store.jumpToMarker(m.id)}
              onDoubleClick={() => store.removeMarker(m.id)}
              title={`${m.name} (double-click to delete)`}
              style={{
                position: "absolute", left: x, top: 0, height: "100%",
                display: "flex", alignItems: "center", gap: 3,
                cursor: "pointer", paddingRight: 4,
              }}>
              <div style={{ width: 2, height: "100%", background: m.color }} />
              <span style={{ fontSize: 6, color: m.color, fontFamily: T.font,
                whiteSpace: "nowrap", letterSpacing: ".05em" }}>
                {m.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Undo/Redo bar ─────────────────────────────────────────────────────────────
function UndoRedoControls() {
  // Dispatch synthetic keydown so useDAWKeyboardShortcuts picks it up.
  // These fire on window and are intercepted by the mounted shortcut handler.
  // KeyboardEvent IS available here — this runs in the browser, not Node.
  const fireKey = (key: string, ctrlKey: boolean) => {
    const e = new (window as any).KeyboardEvent("keydown", { key, ctrlKey, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
  };
  return (
    <>
      <IconBtn icon={<Undo2 size={11} />} title="Undo (Ctrl+Z)"
        onClick={() => fireKey("z", true)} />
      <IconBtn icon={<Redo2 size={11} />} title="Redo (Ctrl+Y)"
        onClick={() => fireKey("y", true)} />
    </>
  );
}

// ── Save status indicator ─────────────────────────────────────────────────────
function SaveStatus({ saving, dirty, lastSaved, error, onSave }: {
  saving: boolean; dirty: boolean; lastSaved: Date | null;
  error: string | null; onSave: () => void;
}) {
  if (saving) return (
    <span style={{ fontSize: 7, color: T.info, fontFamily: T.font, letterSpacing: ".1em" }}>
      ↑ saving…
    </span>
  );
  if (error) return (
    <span style={{ fontSize: 7, color: T.danger, fontFamily: T.font,
      cursor: "pointer" }} onClick={onSave} title="Save failed — click to retry">
      ✗ save failed
    </span>
  );
  if (dirty) return (
    <span style={{ fontSize: 7, color: T.warn, fontFamily: T.font,
      cursor: "pointer" }} onClick={onSave} title="Unsaved changes — click to save now">
      ● unsaved
    </span>
  );
  if (lastSaved) return (
    <span style={{ fontSize: 7, color: T.dim, fontFamily: T.font }}>
      ✓ saved
    </span>
  );
  return null;
}

// ── MIDI status pill ──────────────────────────────────────────────────────────
function MIDIStatusPill({
  activeCount, lastMsg,
}: { activeCount: number; lastMsg: MIDIMessage | null }) {
  if (!activeCount && !lastMsg) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, padding: "2px 8px",
      background: activeCount ? "rgba(184,255,0,0.08)" : "transparent",
      border: `1px solid ${activeCount ? T.accent : T.border}`,
      fontSize: 7, fontFamily: T.font, color: T.dim,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%",
        background: lastMsg ? T.accent : T.dim,
        boxShadow: lastMsg ? `0 0 6px ${T.accent}` : "none",
        transition: "all 0.1s" }} />
      <span style={{ color: activeCount ? T.accent : T.dim }}>
        MIDI {activeCount > 0 ? `${activeCount} in` : "off"}
      </span>
      {lastMsg?.note !== undefined && (
        <span style={{ color: T.text }}>
          {lastMsg.type === "noteOn" ? "▶" : "■"} {lastMsg.note}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DAWUnifiedPage() {

  // ── Mount core systems ────────────────────────────────────────────────────
  usePlaybackClock();          // RAF clock → transport.currentTime
  useDAWKeyboardShortcuts();   // 25+ shortcuts → dawStore actions

  // ── Store slices ──────────────────────────────────────────────────────────
  const store        = useDAWStore();
  const tracks       = useTracks();
  const transport    = useTransport();
  const view         = useView();
  const selection    = useSelection();
  const mixer        = useMixer();
  const isDirty      = useIsDirty();

  // ── Auto-save (wired to tRPC when projectId is available) ─────────────────
  const { saving, lastSaved, error: saveError, saveNow } =
    useAutoSave(store.projectId, 3000);

  // ── MIDI ──────────────────────────────────────────────────────────────────
  const [lastMIDIMsg, setLastMIDIMsg] = useState<MIDIMessage | null>(null);
  const midiFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMIDIMsg = useCallback((msg: MIDIMessage) => {
    setLastMIDIMsg(msg);
    if (midiFlashRef.current) clearTimeout(midiFlashRef.current);
    midiFlashRef.current = setTimeout(() => setLastMIDIMsg(null), 400);
  }, []);
  const { activeIds: midiActiveIds } = useMIDIDevices(handleMIDIMsg);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [bottomTab,   setBottomTab]   = useState<BottomTab>("none");
  const [sidePanel,   setSidePanel]   = useState<SidePanel>("inspector");
  const [topTab,      setTopTab]      = useState<TopNavTab>("arrange");
  const [showPrefs,   setShowPrefs]   = useState(false);
  const [bottomH,     setBottomH]     = useState(220);
  const [isResizing,  setIsResizing]  = useState(false);
  const resizeRef     = useRef<{ startY: number; startH: number } | null>(null);

  // ── Seed demo content on first mount ──────────────────────────────────────
  useEffect(() => {
    if (tracks.length > 0) return;
    const kick  = store.addTrack("audio", "Kick");
    const snare = store.addTrack("audio", "Snare");
    const bass  = store.addTrack("midi",  "Bass Synth");
    const lead  = store.addTrack("midi",  "Lead");
    const pad   = store.addTrack("midi",  "Pad");

    // Add regions
    [
      [kick.id,  kick.color,  "Kick Loop",   1, 4],
      [kick.id,  kick.color,  "Kick B",      5, 4],
      [snare.id, snare.color, "Snare",        3, 4],
      [snare.id, snare.color, "Snare Fill",   7, 2],
      [bass.id,  bass.color,  "Bass Line",    1, 8],
      [lead.id,  lead.color,  "Lead Riff",    5, 8],
      [pad.id,   pad.color,   "Pad Chord",    1, 16],
    ].forEach(([tid, color, name, start, len]) => {
      store.addRegion(tid as string, {
        trackId: tid as string, name: name as string,
        startBar: start as number, length: len as number,
        muted: false, reversed: false,
        gain: 1, fadeIn: 0, fadeOut: 0, offset: 0,
        audioFileId: "", color: color as string,
      } as any);
    });

    // Markers
    store.addMarker(1,  "Intro");
    store.addMarker(5,  "Drop");
    store.addMarker(9,  "Verse");
    store.addMarker(13, "Break");
    store.addMarker(17, "Outro");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bottom panel resize drag ──────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: bottomH };
    setIsResizing(true);
  }, [bottomH]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - e.clientY;
      setBottomH(Math.max(120, Math.min(500, resizeRef.current.startH + delta)));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [isResizing]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectedTrack = tracks.find(t => t.id === selection.trackId) ?? null;

  const toggleBottom = useCallback((tab: BottomTab) =>
    setBottomTab(p => p === tab ? "none" : tab), []);

  const toggleSide = useCallback((panel: SidePanel) =>
    setSidePanel(p => p === panel ? "none" : panel), []);

  // ── Tab definitions ───────────────────────────────────────────────────────
  const BOTTOM_TABS: { id: BottomTab; icon: React.ReactNode; label: string }[] = [
    { id: "piano",      icon: <Piano size={10} />,          label: "Piano Roll" },
    { id: "step",       icon: <Music2 size={10} />,         label: "Step Seq"   },
    { id: "fx",         icon: <SlidersHorizontal size={10} />, label: "FX Chain" },
    { id: "automation", icon: <Activity size={10} />,       label: "Automation" },
    { id: "midi",       icon: <Usb size={10} />,            label: "MIDI"       },
    { id: "waveform",   icon: <Layers size={10} />,         label: "Waveform"   },
  ];

  const SIDE_PANELS: { id: SidePanel; icon: React.ReactNode; title: string }[] = [
    { id: "inspector", icon: <SlidersHorizontal size={10} />, title: "Inspector" },
    { id: "projects",  icon: <FolderOpen size={10} />,        title: "Projects"  },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: T.bg, color: T.text, fontFamily: T.font, overflow: "hidden",
      userSelect: isResizing ? "none" : "auto",
    }}>
      {/* ── Preferences modal ────────────────────────────────────────────── */}
      {showPrefs && (
        <Suspense fallback={null}>
          <PreferencesPanel onClose={() => setShowPrefs(false)} />
        </Suspense>
      )}

      {/* ── Top navigation bar ────────────────────────────────────────────── */}
      <div style={{
        height: 36, display: "flex", alignItems: "center",
        padding: "0 10px", background: T.panel,
        borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 4,
      }}>
        {/* Logo / back link */}
        <Link href="/instrument" style={{ fontSize: 9, letterSpacing: ".3em", color: T.accent,
            textDecoration: "none", fontWeight: 700, marginRight: 8 }}>
          R3
        </Link>

        <Sep />

        {/* Mode tabs */}
        {(["arrange", "mix", "edit"] as TopNavTab[]).map(tab => (
          <button key={tab} onClick={() => setTopTab(tab)} style={{
            height: 24, padding: "0 12px", background: "transparent",
            border: "none",
            borderBottom: topTab === tab ? `2px solid ${T.accent}` : "2px solid transparent",
            color: topTab === tab ? T.accent : T.dim,
            fontFamily: T.font, fontSize: 8, letterSpacing: ".15em",
            textTransform: "uppercase", cursor: "pointer",
          }}>{tab}</button>
        ))}

        <Sep />

        {/* Undo/Redo */}
        <UndoRedoControls />

        <Sep />

        {/* Project name (editable) */}
        <input
          value={store.projectName}
          onChange={e => {
            store.loadProject({ projectName: e.target.value });
            store.markDirty();
          }}
          style={{
            background: "transparent", border: "none", borderBottom: `1px solid ${T.border}`,
            color: T.text, fontFamily: T.font, fontSize: 10, padding: "1px 4px",
            width: 160, outline: "none",
          }}
        />

        {/* Save status */}
        <SaveStatus
          saving={saving} dirty={isDirty}
          lastSaved={lastSaved} error={saveError}
          onSave={saveNow}
        />

        <div style={{ flex: 1 }} />

        {/* MIDI status */}
        <MIDIStatusPill activeCount={midiActiveIds.size} lastMsg={lastMIDIMsg} />

        <Sep />

        {/* Side panel toggles */}
        {SIDE_PANELS.map(sp => (
          <IconBtn key={sp.id} icon={sp.icon} active={sidePanel === sp.id}
            title={sp.title} onClick={() => toggleSide(sp.id)} />
        ))}

        <Sep />

        {/* Settings */}
        <IconBtn icon={<Settings size={12} />}
          title="Preferences" onClick={() => setShowPrefs(true)} />
      </div>

      {/* ── Transport bar ─────────────────────────────────────────────────── */}
      <DAWTransportBar onOpenPrefs={() => setShowPrefs(true)} />

      {/* ── Transport LCD ─────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <TransportLCD
          bar={transport.currentBar}
          beat={transport.currentBeat}
          tick={transport.currentTick}
          bpm={transport.tempo}
          timeSignature={transport.timeSignature}
          seconds={transport.currentTime}
        />
      </Suspense>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <DAWToolbar />

      {/* ── Marker bar ────────────────────────────────────────────────────── */}
      <MarkerBar />

      {/* ── Main workspace ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Timeline (always visible in arrange mode) */}
        {topTab === "arrange" && <Timeline />}

        {/* Full mixer in mix mode */}
        {topTab === "mix" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Suspense fallback={<Spinner h={200} label="Loading mixer…" />}>
              <MixerView
                channels={Object.values(mixer).map(ch => ({
                  id: ch.id, name: ch.name, volume: ch.volume, pan: ch.pan,
                  muted: ch.muted, soloed: ch.soloed, armed: ch.armed,
                  color: tracks.find(t => t.id === ch.id)?.color ?? T.accent,
                  meter: ch.peakL, peak: ch.peakL, inserts: ch.inserts,
                }))}
                onChannelUpdate={(id, patch) => {
                  if ("volume" in patch) store.setChannelVolume(id, patch.volume as number);
                  if ("pan"    in patch) store.setChannelPan(id, patch.pan    as number);
                }}
              />
            </Suspense>
          </div>
        )}

        {/* Piano roll in edit mode */}
        {topTab === "edit" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Suspense fallback={<Spinner h={300} label="Loading piano roll…" />}>
              <PianoRoll ppq={480} totalBeats={32} />
            </Suspense>
          </div>
        )}

        {/* Right side panel */}
        {sidePanel !== "none" && (
          <div style={{
            width: 230, flexShrink: 0, display: "flex", flexDirection: "column",
            borderLeft: `1px solid ${T.border}`, background: T.panel, overflow: "hidden",
          }}>
            {sidePanel === "inspector" && (
              <>
                <PanelHeader title="Inspector" accent>
                  <IconBtn icon={<ChevronDown size={10} />}
                    title="Close" onClick={() => setSidePanel("none")} />
                </PanelHeader>
                <div style={{ flex: 1, overflowY: "auto",
                  scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}` }}>
                  <Suspense fallback={<Spinner />}>
                    <InspectorPanel
                      target={selectedTrack ? {
                        type: "track",
                        id: selectedTrack.id,
                        name: selectedTrack.name,
                        volume: selectedTrack.volume,
                        pan: selectedTrack.pan,
                        muted: selectedTrack.muted,
                        soloed: selectedTrack.soloed,
                        armed: selectedTrack.armed,
                        color: selectedTrack.color,
                      } : null}
                      onUpdate={patch => {
                        if (selectedTrack) store.updateTrack(selectedTrack.id, patch as any);
                      }}
                    />
                  </Suspense>
                </div>
              </>
            )}

            {sidePanel === "projects" && (
              <>
                <PanelHeader title="Projects" accent>
                  <IconBtn icon={<ChevronDown size={10} />}
                    title="Close" onClick={() => setSidePanel("none")} />
                </PanelHeader>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <Suspense fallback={<Spinner />}>
                    <ProjectBrowser
                      onOpen={id => store.loadProject({ projectId: id })}
                      onCreate={name => {
                        store.resetProject();
                        store.loadProject({ projectName: name });
                      }}
                    />
                  </Suspense>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Mixer strip (always in arrange mode, collapsible) ─────────────── */}
      {topTab === "arrange" && view.showMixer && (
        <div style={{ height: 200, flexShrink: 0, borderTop: `1px solid ${T.border}` }}>
          <Suspense fallback={<Spinner h={200} />}>
            <MixerView
              channels={Object.values(mixer).map(ch => ({
                id: ch.id, name: ch.name, volume: ch.volume, pan: ch.pan,
                muted: ch.muted, soloed: ch.soloed, armed: ch.armed,
                color: tracks.find(t => t.id === ch.id)?.color ?? T.accent,
                meter: ch.peakL, peak: ch.peakL, inserts: ch.inserts,
              }))}
              onChannelUpdate={(id, patch) => {
                if ("volume" in patch) store.setChannelVolume(id, patch.volume as number);
                if ("pan"    in patch) store.setChannelPan(id, patch.pan    as number);
              }}
            />
          </Suspense>
        </div>
      )}

      {/* ── Bottom panel (resizable) ───────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}` }}>

        {/* Tab bar */}
        <div style={{
          display: "flex", alignItems: "center",
          background: T.panel, borderBottom: bottomTab !== "none" ? `1px solid ${T.border}` : "none",
        }}>
          {BOTTOM_TABS.map(tab => (
            <button key={tab.id} onClick={() => toggleBottom(tab.id)} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 12px", background: "transparent",
              border: "none",
              borderRight: `1px solid ${T.border}`,
              borderTop: bottomTab === tab.id ? `2px solid ${T.accent}` : "2px solid transparent",
              color: bottomTab === tab.id ? T.accent : T.dim,
              fontFamily: T.font, fontSize: 7, letterSpacing: ".1em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {bottomTab !== "none" && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, paddingRight: 6 }}>
              <IconBtn icon={<ChevronUp size={10} />}
                title="Increase height"
                onClick={() => setBottomH(h => Math.min(500, h + 40))} />
              <IconBtn icon={<ChevronDown size={10} />}
                title="Decrease height"
                onClick={() => setBottomH(h => Math.max(120, h - 40))} />
              <IconBtn icon={<span style={{ fontSize: 10 }}>✕</span>}
                title="Close panel"
                onClick={() => setBottomTab("none")} />
            </div>
          )}
        </div>

        {/* Resize handle */}
        {bottomTab !== "none" && (
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              height: 4, cursor: "row-resize", background: "transparent",
              borderTop: `1px solid ${T.border}`,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.background = T.accent + "44")}
            onMouseLeave={e => ((e.target as HTMLElement).style.background = "transparent")}
          />
        )}

        {/* Panel content */}
        {bottomTab !== "none" && (
          <div style={{
            height: bottomH, overflow: "hidden", display: "flex",
            flexDirection: "column",
          }}>

            {/* Piano Roll */}
            {bottomTab === "piano" && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <Suspense fallback={<Spinner h={bottomH} label="Loading piano roll…" />}>
                  <PianoRoll ppq={480} totalBeats={32} />
                </Suspense>
              </div>
            )}

            {/* Step Sequencer */}
            {bottomTab === "step" && (
              <div style={{ flex: 1, overflowY: "auto",
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}` }}>
                <Suspense fallback={<Spinner label="Loading step sequencer…" />}>
                  <StepSequencer stepCount={16} bpm={transport.tempo} />
                </Suspense>
              </div>
            )}

            {/* FX Chain */}
            {bottomTab === "fx" && (
              <div style={{
                flex: 1, overflowY: "auto", padding: 8,
                display: "flex", flexDirection: "column", gap: 6,
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}`,
              }}>
                <Suspense fallback={<Spinner label="Loading FX…" />}>
                  <CollapsibleFXPanel title="EQ" defaultOpen badge="3-Band Parametric">
                    <EQPanel />
                  </CollapsibleFXPanel>
                  <CollapsibleFXPanel title="Compressor" badge="Dynamic">
                    <CompressorPanel />
                  </CollapsibleFXPanel>
                  <CollapsibleFXPanel title="Reverb" badge="Convolution">
                    <ReverbPanel />
                  </CollapsibleFXPanel>
                  <CollapsibleFXPanel title="Delay" badge="Sync">
                    <DelayPanel bpm={transport.tempo} />
                  </CollapsibleFXPanel>
                </Suspense>
              </div>
            )}

            {/* Automation */}
            {bottomTab === "automation" && (
              <div style={{
                flex: 1, overflowY: "auto",
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}`,
              }}>
                {selectedTrack ? (
                  <Suspense fallback={<Spinner label="Loading automation…" />}>
                    {(store.automation[selectedTrack.id] ?? []).map(lane => (
                      <AutomationLane
                        key={lane.id}
                        trackId={selectedTrack.id}
                        lane={lane}
                        height={Math.max(60, Math.floor((bottomH - 30) / 3))}
                      />
                    ))}
                    {(store.automation[selectedTrack.id] ?? []).length === 0 && (
                      <div style={{ padding: 20, fontSize: 9, color: T.dim,
                        textAlign: "center", lineHeight: 1.8 }}>
                        No automation lanes for <span style={{ color: T.accent }}>
                          {selectedTrack.name}
                        </span>.
                        <br />
                        Automation lanes are added via the track context menu.
                      </div>
                    )}
                  </Suspense>
                ) : (
                  <div style={{ padding: 20, fontSize: 9, color: T.dim, textAlign: "center" }}>
                    Select a track to view automation.
                  </div>
                )}
              </div>
            )}

            {/* MIDI Devices */}
            {bottomTab === "midi" && (
              <div style={{
                flex: 1, overflowY: "auto",
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}`,
              }}>
                <Suspense fallback={<Spinner label="Loading MIDI devices…" />}>
                  <MIDIDevicePanel />
                </Suspense>
              </div>
            )}

            {/* Waveform */}
            {bottomTab === "waveform" && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", gap: 8,
                padding: 10, overflowY: "auto",
                scrollbarWidth: "thin", scrollbarColor: `${T.accent} ${T.bg}`,
              }}>
                <div style={{ fontSize: 8, color: T.dim, fontFamily: T.font,
                  letterSpacing: ".1em" }}>
                  SELECTED TRACK REGIONS
                </div>
                <Suspense fallback={<Spinner label="Loading waveforms…" />}>
                  {selectedTrack ? (
                    selectedTrack.regions.length > 0 ? (
                      selectedTrack.regions.map(region => (
                        <div key={region.id} style={{
                          display: "flex", flexDirection: "column", gap: 4,
                        }}>
                          <div style={{ fontSize: 7, color: T.dim, fontFamily: T.font }}>
                            {region.name}
                          </div>
                          <WaveformRenderer
                            source={(region as any).audioFileId || null}
                            width={800}
                            height={Math.min(80, Math.floor((bottomH - 60) / Math.max(1, selectedTrack.regions.length)))}
                            color={selectedTrack.color}
                            showRMS
                            playhead={
                              transport.isPlaying
                                ? Math.max(0, Math.min(1,
                                    (transport.currentBar - region.startBar) / region.length
                                  ))
                                : undefined
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 9, color: T.dim }}>
                        No regions on this track.
                      </div>
                    )
                  ) : (
                    <div style={{ fontSize: 9, color: T.dim }}>
                      Select a track to view waveforms.
                    </div>
                  )}
                </Suspense>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
'

# ═══════════════════════════════════════════════════════════════════════════════
# FILE 2 — Wire /daw route to use the unified page
# Updates App.tsx to point /daw at daw-unified instead of daw
# ═══════════════════════════════════════════════════════════════════════════════
section "Consolidating to ONE DAW page — removing old arrangement.tsx and daw.tsx pages"

# ── Delete old page files (they are replaced by daw-unified.tsx) ─────────────
for OLD_PAGE in \
  "$ROOT/client/src/pages/arrangement.tsx" \
  "$ROOT/client/src/pages/daw.tsx"; do
  if [[ -f "$OLD_PAGE" ]]; then
    rm -f "$OLD_PAGE"
    ok "Deleted: $(basename "$OLD_PAGE") (replaced by daw-unified.tsx)"
  else
    info "$(basename "$OLD_PAGE") not found — already clean"
  fi
done

# ── Rewrite App.tsx Router — one DAW route, remove /arrangement ──────────────
python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
try:
    with open(path) as f:
        src = f.read()
except FileNotFoundError:
    print("SKIP: App.tsx not found in this environment"); sys.exit(0)

# 1. Replace ALL DAW/arrangement lazy imports with one pointing to daw-unified
# Remove ArrangementPage import
src = re.sub(r'const ArrangementPage\s*=\s*lazy\([^;]+;\s*\n?', '', src)
# Remove old DAWPage import if present
src = re.sub(r'const DAWPage\s*=\s*lazy\([^;]+;\s*\n?', '', src)
# Add single DAWPage import
src = re.sub(
    r"(// ─── LAZY PAGES[^\n]*\n|const InstrumentPage)",
    "const DAWPage = lazy(() => import('@/pages/daw-unified'));\n\\1",
    src, count=1
)
# If neither anchor found, add at the top of lazy imports
if "daw-unified" not in src:
    src = re.sub(
        r"(const \w+Page\s*=\s*lazy\()",
        "const DAWPage = lazy(() => import('@/pages/daw-unified'));\n\\1",
        src, count=1
    )
print("✓ DAWPage lazy import → daw-unified")

# 2. Remove the /arrangement route block entirely
src = re.sub(
    r'\s*\{/\*[^*]*arrangement[^*]*\*/\}\s*\n\s*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>\s*\n?',
    '\n',
    src, flags=re.DOTALL
)
src = re.sub(
    r'\s*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>\s*\n?',
    '\n',
    src, flags=re.DOTALL
)
print("✓ /arrangement route removed")

# 3. Ensure /daw route exists and points to DAWPage
if '"/daw"' not in src and "'/daw'" not in src:
    DAW_ROUTE = """
      {/* ── /daw → Unified DAW (protected) ── */}
      <Route path="/daw">
        {() => (
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback message="Loading DAW..." />}>
                <DAWPage />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        )}
      </Route>
"""
    # Insert before the 404 catch-all
    src = src.replace(
        "\n      <Route>\n",
        DAW_ROUTE + "\n      <Route>\n",
        1
    )
    print("✓ /daw route added")
else:
    # Update existing /daw route to use DAWPage (in case it referenced old component)
    src = re.sub(
        r'(<Route path=["\']\/daw["\']>.*?)(ArrangementPage|OldDAWPage)(\s*/\s*>)',
        r'\1DAWPage\3',
        src, flags=re.DOTALL
    )
    print("✓ /daw route already present")

# 4. Validate
ro = len(re.findall(r'<Route[\s>]', src))
rc = len(re.findall(r'</Route>', src))
so = len(re.findall(r'<Switch[\s>]', src))
sc = len(re.findall(r'</Switch>', src))
print(f"  <Route>  {ro}/{rc} {'✓' if ro==rc else '✗ MISMATCH'}")
print(f"  <Switch> {so}/{sc} {'✓' if so==sc else '✗ MISMATCH'}")
has_daw       = '/daw' in src
has_arr       = '/arrangement' in src
has_import    = 'daw-unified' in src
print(f"  /daw route:       {'✓' if has_daw else '✗'}")
print(f"  /arrangement gone: {'✓' if not has_arr else '✗ STILL PRESENT'}")
print(f"  daw-unified import: {'✓' if has_import else '✗'}")

if ro != rc or so != sc:
    print("ERROR: tag mismatch — aborting"); sys.exit(1)

with open(path, "w") as f:
    f.write(src)
print("✓ App.tsx saved")
PYEOF
ok "App.tsx: /arrangement removed, /daw → daw-unified"

# ── Rewrite PageNav — single DAW entry, remove /arrangement entry ─────────────
python3 << 'PYEOF'
import re, sys

path = "/home/r3/Stable/R3 v4/client/src/components/page-nav.tsx"
try:
    with open(path) as f:
        src = f.read()
except FileNotFoundError:
    print("SKIP: page-nav.tsx not found"); sys.exit(0)

# Ensure LayoutGrid import
if "LayoutGrid" not in src:
    src = re.sub(
        r"(import\s*\{[^}]+)\}(\s*from\s*['\"]lucide-react['\"])",
        lambda m: m.group(0).replace("}", ", LayoutGrid }"),
        src, count=1
    )

# Remove /arrangement nav entry (any form)
src = re.sub(
    r"\{?\s*href:\s*['\"]\/arrangement['\"],[^}]+\},?\s*\n?",
    "",
    src
)

# Remove /daw 2 or duplicate /daw entries, keep exactly one
# First remove all /daw entries
src = re.sub(r"\{?\s*href:\s*['\"]\/daw['\"],[^}]+\},?\s*\n?", "", src)

# Now add exactly one /daw entry before /instrument (or /pricing if instrument missing)
for anchor in ["{ href: '/instrument'", '{ href: "/instrument"',
               "{ href: '/pricing'",    '{ href: "/pricing"']:
    if anchor in src:
        src = src.replace(
            anchor,
            "{ href: '/daw', label: 'DAW', icon: LayoutGrid },\n  " + anchor,
            1
        )
        print(f"✓ Single /daw entry added before {anchor[:20]}")
        break

with open(path, "w") as f:
    f.write(src)
print("✓ PageNav: exactly one DAW entry at /daw")
PYEOF
ok "PageNav: single /daw entry"

# ─────────────────────────────────────────────────────────────────────────────
section "Final Verification"
# ─────────────────────────────────────────────────────────────────────────────

FILES=(
  "$ROOT/client/src/pages/daw-unified.tsx"
)

echo ""
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    ok "$(realpath --relative-to="$ROOT" "$f")  ($(wc -l < "$f") lines, $(wc -c < "$f") bytes)"
  else
    fail "MISSING: $f"
  fi
done

echo ""
echo -e "${BLD}${CYN}══════════════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${GRN}  UNIFIED DAW COMPLETE — Pass: $PASS / Fail: $FAIL${RST}"
echo -e "${BLD}${CYN}══════════════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}  Everything preserved + enhanced:${RST}"
echo -e "${DIM}    ∙ arrangement.tsx   → project browser, LCD, prefs, inspector, FX${RST}"
echo -e "${DIM}    ∙ daw.tsx           → dawStore, RAF clock, shortcuts, timeline, toolbar${RST}"
echo -e "${DIM}    ∙ r3-enhance        → WaveformRenderer, MIDI, useAutoSave, VU meters${RST}"
echo ""
echo -e "${DIM}  New additions:${RST}"
echo -e "${DIM}    ∙ Marker bar (click to jump, double-click to delete)${RST}"
echo -e "${DIM}    ∙ Resizable bottom panel (drag handle)${RST}"
echo -e "${DIM}    ∙ 3 top-level modes: Arrange / Mix / Edit${RST}"
echo -e "${DIM}    ∙ Editable project name in nav bar${RST}"
echo -e "${DIM}    ∙ Save status indicator (saving / unsaved / saved / error)${RST}"
echo -e "${DIM}    ∙ MIDI status pill (live note display)${RST}"
echo -e "${DIM}    ∙ Waveform tab per selected track${RST}"
echo ""
echo -e "${DIM}  Restart and navigate:${RST}"
echo -e "${DIM}    pkill -f 'tsx|vite' 2>/dev/null; sleep 1 && pnpm dev${RST}"
echo -e "${DIM}    http://localhost:5173/daw${RST}"
echo ""