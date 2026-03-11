// @ts-nocheck
// components/MixerView.tsx - Professional mixer interface

import React, { useCallback } from 'react';
import { Mic, Volume2, Circle } from 'lucide-react';
import type { MixerViewProps } from '../types';
import { AdvancedMeter } from './advanced-meter';
import { FX_ICONS } from '../constants';

export const MixerView: React.FC<MixerViewProps> = ({
  tracks,
  masterVolume,
  masterMeter,
  masterPeak,
  preferences,
  onUpdateTrack,
  onUpdateMaster,
  onShowVSTPanel,
}) => {
  const getChannelWidth = useCallback(() => {
    switch (preferences.mixerView) {
      case 'narrow':
        return 'w-16';
      case 'medium':
        return 'w-20';
      case 'wide':
        return 'w-24';
      case 'extended':
        return 'w-32';
      default:
        return 'w-20';
    }
  }, [preferences.mixerView]);

  const handleVolumeChange = useCallback(
    (trackId: string, volume: number) => {
      onUpdateTrack(trackId, { volume });
    },
    [onUpdateTrack]
  );

  const handlePanChange = useCallback(
    (trackId: string, pan: number) => {
      onUpdateTrack(trackId, { pan });
    },
    [onUpdateTrack]
  );

  const handleToggle = useCallback(
    (trackId: string, key: 'muted' | 'solo' | 'armed') => {
      const track = tracks.find((t) => t.id === trackId);
      if (track) {
        onUpdateTrack(trackId, { [key]: !track[key] });
      }
    },
    [tracks, onUpdateTrack]
  );

  return (
    <div className="flex-1 bg-background overflow-x-auto overflow-y-hidden">
      <div className="flex h-full gap-1 p-2">
        {/* Track Channels */}
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`${getChannelWidth()} flex-shrink-0 bg-card rounded-lg border border-border flex flex-col`}
          >
            {/* Track Header */}
            <div className="p-2 border-b border-border">
              <div
                className={`h-1 rounded mb-2 ${track.color}`}
                aria-label={`Track color: ${track.color}`}
              />
              <h3 className="text-xs font-semibold text-white truncate" title={track.name}>
                {track.name}
              </h3>
              <span className="text-[10px] text-muted-foreground uppercase">
                {track.type}
              </span>
            </div>

            {/* FX Chain */}
            {preferences.mixerView !== 'narrow' && track.fxChain.length > 0 && (
              <div className="px-2 py-1 border-b border-border">
                <div className="flex flex-wrap gap-1">
                  {track.fxChain.slice(0, 3).map((fx, idx) => (
                    <div
                      key={`${track.id}-fx-${idx}`}
                      className="text-xs bg-muted px-1 rounded"
                      title={fx}
                    >
                      {FX_ICONS[fx]}
                    </div>
                  ))}
                  {track.fxChain.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{track.fxChain.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meter */}
            <div className="flex-1 flex items-center justify-center p-2">
              <AdvancedMeter
                level={track.meter}
                peak={track.peak}
                height={preferences.mixerView === 'narrow' ? 120 : 200}
              />
            </div>

            {/* Fader */}
            <div className="px-2 py-3 space-y-2">
              {/* Volume Fader */}
              <div className="flex flex-col items-center gap-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
                  style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
                  aria-label="Volume"
                />
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(track.volume * 100)}%
                </span>
              </div>

              {/* Pan Knob */}
              {preferences.mixerView !== 'narrow' && (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={track.pan}
                    onChange={(e) => handlePanChange(track.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                    aria-label="Pan"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-2 border-t border-border space-y-1">
              <div className="flex gap-1">
                <button
                  onClick={() => handleToggle(track.id, 'muted')}
                  className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
                    track.muted
                      ? 'bg-red-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={() => handleToggle(track.id, 'solo')}
                  className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
                    track.solo
                      ? 'bg-yellow-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                  title="Solo"
                >
                  S
                </button>
                <button
                  onClick={() => handleToggle(track.id, 'armed')}
                  className={`flex-1 px-2 py-1 text-[10px] rounded transition-colors ${
                    track.armed
                      ? 'bg-red-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                  title="Arm for recording"
                >
                  <Circle size={10} className="mx-auto" />
                </button>
              </div>

              {preferences.mixerView !== 'narrow' && (
                <button
                  onClick={() => onShowVSTPanel(track.id)}
                  className="w-full px-2 py-1 text-[10px] bg-muted text-muted-foreground hover:bg-muted rounded transition-colors"
                >
                  VST
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Master Channel */}
        <div
          className={`${getChannelWidth()} flex-shrink-0 bg-card rounded-lg border-2 border-blue-600 flex flex-col`}
        >
          {/* Master Header */}
          <div className="p-2 border-b border-border">
            <h3 className="text-xs font-bold text-blue-400 text-center">MASTER</h3>
          </div>

          {/* Master Meter */}
          <div className="flex-1 flex items-center justify-center p-2">
            <AdvancedMeter
              level={masterMeter}
              peak={masterPeak}
              height={preferences.mixerView === 'narrow' ? 120 : 200}
            />
          </div>

          {/* Master Fader */}
          <div className="px-2 py-3 space-y-2">
            <div className="flex flex-col items-center gap-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={(e) => onUpdateMaster(parseFloat(e.target.value))}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full"
                style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
                aria-label="Master Volume"
              />
              <span className="text-[10px] text-blue-400 font-semibold">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
          </div>

          <div className="p-2 border-t border-border">
            <div className="text-center text-[10px] text-muted-foreground">
              <Volume2 size={12} className="mx-auto mb-1" />
              Output
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};