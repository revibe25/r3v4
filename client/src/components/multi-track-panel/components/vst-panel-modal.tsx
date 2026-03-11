// @ts-nocheck
// client/src/components/multi-track-panel/components/vst-panel-modal.tsx
//
// Uses useVSTContextOptional — safe on /multitrack where VSTProvider is absent.
// FIXED vs original:
//   1. `vstState.tracks` removed — VSTContextType has no such property.
//      Track name now received as a prop (parent has project state).
//   2. Switched to useVSTContextOptional() — modal is mounted on /multitrack
//      where VSTProvider is not present. No longer crashes on load.
//   3. Channel lookup uses `channels` array (correct API) instead of
//      `vstState.tracks` (did not exist).
//   4. Friendly offline message shown when VST engine is not yet active.

import React from 'react';
import { X, Zap } from 'lucide-react';
import { useVSTContextOptional } from '@/App';
import { VSTPluginManager } from '@/components/vst-plugin-manager';
import { VSTPerformanceUI } from '@/components/vst-performance-monitor-ui';
import type { VSTPanelModalProps } from '../types';

// Extend base props with trackName — passed by MultiTrackPanel which owns
// project state. Avoids coupling this modal to the VST context for a string.
interface Props extends VSTPanelModalProps {
  trackName?: string;
}

export const VSTPanelModal: React.FC<Props> = ({
  trackId,
  trackName = 'Unknown Track',
  onClose,
}) => {
  const vstContext = useVSTContextOptional();

  // Only attempt a channel lookup when the VST engine is live.
  const channelIndex = vstContext
    ? vstContext.channels.findIndex((c) => c.id === trackId)
    : -1;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div
        className="bg-[#0d0d0d] border border-[#1c1c1c] shadow-2xl w-[800px] max-h-[80vh]
                   overflow-hidden flex flex-col"
        style={{ borderLeft: '4px solid #a3e635' }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1c1c] bg-[#0a0a0a] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#a3e635]" />
            <h2 className="text-sm font-semibold text-[#f0f0f0] font-mono tracking-widest uppercase">
              VST Plugins — {trackName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#f0f0f0] transition-colors p-1"
            aria-label="Close VST panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* VST engine not yet initialised (user hasn't visited /vst) */}
          {!vstContext && (
            <div className="text-center py-10 font-mono text-xs tracking-wider space-y-3">
              <Zap size={28} className="mx-auto text-[#a3e635] opacity-50" />
              <p className="text-[#a3e635] font-semibold">VST Engine not active</p>
              <p className="text-[#666]">
                Navigate to{' '}
                <span
                  className="text-[#f0f0f0] underline cursor-pointer"
                  onClick={() => { onClose(); window.location.href = '/vst'; }}
                >
                  /vst
                </span>{' '}
                once to initialise the audio engine,
              </p>
              <p className="text-[#666]">then return here to manage plugins.</p>
            </div>
          )}

          {/* Engine live but channel not found */}
          {vstContext && channelIndex < 0 && (
            <div className="text-center py-10 font-mono text-xs text-[#666] tracking-wider">
              Channel not registered in VST engine
            </div>
          )}

          {/* Normal state */}
          {vstContext && channelIndex >= 0 && (
            <>
              <VSTPluginManager trackId={channelIndex} />
              <VSTPerformanceUI trackId={channelIndex} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};