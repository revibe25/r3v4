// client/src/components/multi-track-panel/components/preferences-modal.tsx

import React from 'react';
import { X, Settings, Save } from 'lucide-react';
import type { PreferencesModalProps, MixerView, TimeFormat, ViewMode } from '../types';

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  preferences,
  onUpdate,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        className="bg-[#0d0d0d] border border-[#1c1c1c] shadow-2xl w-[520px] max-h-[80vh]
                   overflow-hidden flex flex-col"
        style={{ borderLeft: '4px solid #a3e635' }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1c1c] bg-[#0a0a0a] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[#a3e635]" />
            <h2 className="text-sm font-semibold text-[#f0f0f0] font-mono tracking-widest uppercase">
              Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#f0f0f0] transition-colors p-1"
            aria-label="Close preferences"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5 font-mono text-xs">

          {/* ── View ──────────────────────────────────────────────────── */}
          <section>
            <p className="text-[#a3e635] tracking-widest uppercase text-[10px] mb-3 border-b border-[#1c1c1c] pb-1">
              View
            </p>

            {/* View Mode */}
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#888]">View Mode</label>
              <div className="flex gap-1">
                {(['mixer', 'timeline', 'split'] as ViewMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => onUpdate({ viewMode: m })}
                    className="px-2 py-1 text-[10px] tracking-wider uppercase transition-colors"
                    style={{
                      background: preferences.viewMode === m ? '#a3e635' : '#0f0f0f',
                      color: preferences.viewMode === m ? '#060606' : '#888',
                      border: `1px solid ${preferences.viewMode === m ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Mixer View */}
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#888]">Mixer Channel Width</label>
              <div className="flex gap-1">
                {(['narrow', 'medium', 'wide', 'extended'] as MixerView[]).map(m => (
                  <button
                    key={m}
                    onClick={() => onUpdate({ mixerView: m })}
                    className="px-2 py-1 text-[10px] tracking-wider uppercase transition-colors"
                    style={{
                      background: preferences.mixerView === m ? '#a3e635' : '#0f0f0f',
                      color: preferences.mixerView === m ? '#060606' : '#888',
                      border: `1px solid ${preferences.mixerView === m ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#888]">Theme</label>
              <div className="flex gap-1">
                {(['dark', 'light'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => onUpdate({ theme: t })}
                    className="px-2 py-1 text-[10px] tracking-wider uppercase transition-colors"
                    style={{
                      background: preferences.theme === t ? '#a3e635' : '#0f0f0f',
                      color: preferences.theme === t ? '#060606' : '#888',
                      border: `1px solid ${preferences.theme === t ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Show CPU Meter */}
            <div className="flex items-center justify-between">
              <label className="text-[#888]">Show CPU Meter</label>
              <button
                onClick={() => onUpdate({ showCpuMeter: !preferences.showCpuMeter })}
                className="w-10 h-5 relative transition-colors flex-shrink-0"
                style={{
                  background: preferences.showCpuMeter ? '#a3e635' : '#1c1c1c',
                  border: '1px solid #2a2a2a',
                }}
                aria-label="Toggle CPU meter"
              >
                <span
                  className="absolute top-0.5 w-4 h-4 transition-transform"
                  style={{
                    background: preferences.showCpuMeter ? '#060606' : '#666',
                    transform: preferences.showCpuMeter ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </section>

          {/* ── Transport ─────────────────────────────────────────────── */}
          <section>
            <p className="text-[#a3e635] tracking-widest uppercase text-[10px] mb-3 border-b border-[#1c1c1c] pb-1">
              Transport
            </p>

            {/* Time Format */}
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#888]">Time Format</label>
              <div className="flex gap-1">
                {(['bars', 'seconds', 'samples', 'smpte'] as TimeFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => onUpdate({ timeFormat: f })}
                    className="px-2 py-1 text-[10px] tracking-wider uppercase transition-colors"
                    style={{
                      background: preferences.timeFormat === f ? '#a3e635' : '#0f0f0f',
                      color: preferences.timeFormat === f ? '#060606' : '#888',
                      border: `1px solid ${preferences.timeFormat === f ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <label className="text-[#888]">Auto Save</label>
              <button
                onClick={() => onUpdate({ autoSave: !preferences.autoSave })}
                className="w-10 h-5 relative transition-colors flex-shrink-0"
                style={{
                  background: preferences.autoSave ? '#a3e635' : '#1c1c1c',
                  border: '1px solid #2a2a2a',
                }}
                aria-label="Toggle auto save"
              >
                <span
                  className="absolute top-0.5 w-4 h-4 transition-transform"
                  style={{
                    background: preferences.autoSave ? '#060606' : '#666',
                    transform: preferences.autoSave ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </section>

          {/* ── Audio ─────────────────────────────────────────────────── */}
          <section>
            <p className="text-[#a3e635] tracking-widest uppercase text-[10px] mb-3 border-b border-[#1c1c1c] pb-1">
              Audio Engine
            </p>

            {/* Buffer Size */}
            <div className="flex items-center justify-between mb-3">
              <label className="text-[#888]">Buffer Size</label>
              <div className="flex gap-1">
                {[128, 256, 512, 1024, 2048].map(b => (
                  <button
                    key={b}
                    onClick={() => onUpdate({ bufferSize: b })}
                    className="px-2 py-1 text-[10px] tracking-wider transition-colors"
                    style={{
                      background: preferences.bufferSize === b ? '#a3e635' : '#0f0f0f',
                      color: preferences.bufferSize === b ? '#060606' : '#888',
                      border: `1px solid ${preferences.bufferSize === b ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Sample Rate */}
            <div className="flex items-center justify-between">
              <label className="text-[#888]">Sample Rate</label>
              <div className="flex gap-1">
                {[44100, 48000, 88200, 96000].map(r => (
                  <button
                    key={r}
                    onClick={() => onUpdate({ sampleRate: r })}
                    className="px-2 py-1 text-[10px] tracking-wider transition-colors"
                    style={{
                      background: preferences.sampleRate === r ? '#a3e635' : '#0f0f0f',
                      color: preferences.sampleRate === r ? '#060606' : '#888',
                      border: `1px solid ${preferences.sampleRate === r ? '#a3e635' : '#1c1c1c'}`,
                    }}
                  >
                    {r >= 1000 ? `${r / 1000}k` : r}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Info row ──────────────────────────────────────────────── */}
          <div className="text-[#3a3a3a] text-[9px] tracking-wider pt-2 border-t border-[#1c1c1c]">
            Changes apply immediately · Audio engine settings take effect on next project load
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#1c1c1c] bg-[#0a0a0a] flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-[10px] tracking-widest uppercase transition-colors font-mono"
            style={{ background: '#a3e635', color: '#060606', border: '1px solid #a3e635' }}
          >
            <Save size={11} /> Done
          </button>
        </div>
      </div>
    </div>
  );
};