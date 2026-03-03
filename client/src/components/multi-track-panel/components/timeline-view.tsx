// components/TimelineView.tsx - Timeline editor with clips and waveforms

import React, { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import type { TimelineViewProps } from '../types';
import { WaveformDisplay } from './waveform-display';
import { formatTime } from '../utils';

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  transport,
  zoom,
  onClipMove,
  onAddClip,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const pixelsPerSecond = 50 * zoom;
  const totalWidth = 300 * pixelsPerSecond; // 5 minutes worth

  const handleFileDrop = useCallback(
    (trackId: string, e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.type.startsWith('audio/')) {
          onAddClip(trackId, file);
        }
      });
    },
    [onAddClip]
  );

  const handleClipDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, clipId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('clipId', clipId);
    },
    []
  );

  const handleClipDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
      e.preventDefault();
      const clipId = e.dataTransfer.getData('clipId');
      if (!clipId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = x / pixelsPerSecond;

      onClipMove(clipId, time);
    },
    [pixelsPerSecond, onClipMove]
  );

  const renderTimeRuler = () => {
    const markers = [];
    const interval = 10; // Every 10 seconds
    
    for (let i = 0; i <= 300; i += interval) {
      markers.push(
        <div
          key={i}
          className="absolute top-0 bottom-0 border-l border-border"
          style={{ left: `${i * pixelsPerSecond}px` }}
        >
          <span className="absolute top-1 left-1 text-[10px] text-muted-foreground">
            {formatTime(i, 'seconds')}
          </span>
        </div>
      );
    }
    
    return markers;
  };

  const renderPlayhead = () => {
    const position = transport.position * pixelsPerSecond;
    
    return (
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-30 pointer-events-none"
        style={{ left: `${position}px` }}
      >
        <div className="absolute -top-1 -left-2 w-4 h-4">
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-blue-500" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Time Ruler */}
      <div className="h-8 bg-card border-b border-border relative overflow-hidden flex-shrink-0">
        <div
          ref={timelineRef}
          className="relative h-full"
          style={{ width: `${totalWidth}px` }}
        >
          {renderTimeRuler()}
        </div>
      </div>

      {/* Tracks Area */}
      <div className="flex-1 overflow-auto">
        <div className="relative" style={{ width: `${totalWidth}px` }}>
          {/* Playhead */}
          {renderPlayhead()}

          {/* Loop Region */}
          {transport.loopEnabled && (
            <div
              className="absolute top-0 bottom-0 bg-green-500/10 border-l-2 border-r-2 border-green-500 z-10 pointer-events-none"
              style={{
                left: `${transport.loopStart * pixelsPerSecond}px`,
                width: `${(transport.loopEnd - transport.loopStart) * pixelsPerSecond}px`,
              }}
            />
          )}

          {/* Tracks */}
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className={`relative h-24 border-b border-border ${
                index % 2 === 0 ? 'bg-card/50' : 'bg-card/30'
              }`}
              onDrop={(e) => handleClipDrop(e, track.id)}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Track Label */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-card border-r border-border flex items-center px-3 z-20">
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-white truncate">
                    {track.name}
                  </h4>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {track.type}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'audio/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        onAddClip(track.id, file);
                      }
                    };
                    input.click();
                  }}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Add clip"
                >
                  <Upload size={12} className="text-muted-foreground" />
                </button>
              </div>

              {/* Clips */}
              <div className="absolute left-32 right-0 top-0 bottom-0">
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={(e) => handleClipDragStart(e, clip.id)}
                    className="absolute top-2 bottom-2 bg-muted border border-border rounded cursor-move hover:border-blue-500 transition-colors overflow-hidden group"
                    style={{
                      left: `${clip.startTime * pixelsPerSecond}px`,
                      width: `${clip.duration * pixelsPerSecond}px`,
                    }}
                  >
                    {/* Clip Header */}
                    <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-card/80 border-b border-border z-10">
                      <span className="text-[10px] text-white truncate block">
                        {clip.fileName}
                      </span>
                    </div>

                    {/* Activity */}
                    {clip.waveformData && (
                      <div className="absolute inset-0 pt-6">
                        <WaveformDisplay
                          waveformData={clip.waveformData}
                          color={clip.color}
                          height={64}
                        />
                      </div>
                    )}

                    {/* Clip Color Indicator */}
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1 ${clip.color}`}
                    />

                    {/* Resize Handles */}
                    <div className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>

              {/* Drop Zone Indicator */}
              <div
                className="absolute left-32 right-0 top-0 bottom-0 pointer-events-none"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('bg-blue-500/10');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bg-blue-500/10');
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};