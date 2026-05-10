// @ts-nocheck
// ============================================================================
// src/components/effects-rack/effect-chain.tsx
// ============================================================================

import { ReverbEffect } from '../../audio/effects/reverb';
import { DelayEffect } from '../../audio/effects/delay';
import { FilterEffect } from '../../audio/effects/filter';
import type { AnyEffectParams, EffectChainNode } from '@shared/effects.types';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X, Copy } from 'lucide-react';

interface EffectChainProps {
  effects: EffectChainNode[];
  onEffectChange: (nodeId: string, params: AnyEffectParams) => void;
  onRemove: (nodeId: string) => void;
}

export const EffectChain: React.FC<EffectChainProps> = ({
  effects,
  onEffectChange,
  onRemove,
}) => {
  return (
    <div className="space-y-3 bg-card rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-200">Effect Chain</h3>
      {effects.map((effect, index) => (
        <EffectNode
          key={effect.id}
          effect={effect}
          index={index}
          onChange={(params) => onEffectChange(effect.id, params)}
          onRemove={() => onRemove(effect.id)}
        />
      ))}
    </div>
  );
};

interface EffectNodeProps {
  effect: EffectChainNode;
  index: number;
  onChange: (params: AnyEffectParams) => void;
  onRemove: () => void;
}

const EffectNode: React.FC<EffectNodeProps> = ({
  effect,
  index,
  onChange,
  onRemove,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-muted border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{index + 1}.</span>
          <span className="text-sm font-medium text-gray-200 capitalize">
            {effect.type}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? '−' : '+'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="h-6 w-6 p-0 text-red-400"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 mt-3 pt-3 border-t border-border">
          {/* Render parameters based on effect type */}
          {effect.type === 'reverb' && (
            <ReverbControls params={effect.params} onChange={onChange} />
          )}
          {effect.type === 'delay' && (
            <DelayControls params={effect.params} onChange={onChange} />
          )}
          {/* Add more effect controls */}
        </div>
      )}
    </Card>
  );
};

// TODO: Implement ReverbControls, DelayControls, etc.
const ReverbControls = ({ params, onChange }: any) => (
  <div className="text-xs text-muted-foreground">Reverb controls coming...</div>
);

const DelayControls = ({ params, onChange }: any) => (
  <div className="text-xs text-muted-foreground">Delay controls coming...</div>
);

// ============================================================================
// src/components/dj-controls/crossfader.tsx
// ============================================================================


interface CrossfaderProps {
  state: CrossfaderState;
  onChange: (position: number) => void;
}

export const Crossfader: React.FC<CrossfaderProps> = ({ state, onChange }) => {
  const handleChange = useCallback(
    (values: number[]) => {
      onChange(values[0]);
    },
    [onChange]
  );

  return (
    <Card className="bg-muted border-border p-4">
      <div className="space-y-4">
        {/* Crossfader slider */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Channel A</span>
            <span className="text-xs font-medium text-gray-300">Channel B</span>
          </div>
          <Slider
            value={[state.range]}
            min={-1}
            max={1}
            step={0.01}
            onValueChange={handleChange}
            className="w-full"
          />
        </div>

        {/* Volume indicators */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-muted-foreground">
            A: {(state.leftVolume * 100).toFixed(0)}%
          </div>
          <div className="text-muted-foreground text-right">
            B: {(state.rightVolume * 100).toFixed(0)}%
          </div>
        </div>

        {/* Latency display */}
        {state.latency > 0 && (
          <div className="text-xs text-gray-500">
            Latency: {state.latency.toFixed(2)}ms
          </div>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// src/components/dj-controls/hot-cues.tsx
// ============================================================================

import type { HotCue } from '@shared/dj.types';
import { cn } from '@/lib/utils';

interface HotCuesProps {
  cues: HotCue[];
  selectedCue?: string;
  onCueJump: (index: number) => void;
  onCueSet: (index: number) => void;
  onCueDelete: (index: number) => void;
}

export const HotCues: React.FC<HotCuesProps> = ({
  cues,
  selectedCue,
  onCueJump,
  onCueSet,
  onCueDelete,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {cues.map((cue) => (
        <div
          key={cue.id}
          className="flex flex-col items-center gap-1"
          onContextMenu={(e) => {
            e.preventDefault();
            onCueDelete(cue.index);
          }}
        >
          <Button
            onClick={() => (cue.isActive ? onCueJump(cue.index) : onCueSet(cue.index))}
            className={cn(
              'w-12 h-12 rounded-lg font-semibold text-xs',
              cue.isActive
                ? 'bg-opacity-80'
                : 'bg-muted hover:bg-accent text-muted-foreground'
            )}
            style={
              cue.isActive
                ? { backgroundColor: cue.color, color: 'var(--white)' }
                : undefined
            }
          >
            {cue.index}
          </Button>
          {cue.label && (
            <span className="text-xs text-muted-foreground truncate">{cue.label}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// src/components/waveform-editor/waveform-display.tsx
// ============================================================================

import React, { useEffect, useRef } from 'react';


interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  state: unknown;
  selection: WaveformSelection;
  onSelectionChange: (start: number, end: number) => void;
  currentPosition: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioBuffer,
  state,
  selection,
  onSelectionChange,
  currentPosition,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = state.config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform
    ctx.strokeStyle = state.config.waveformColor;
    ctx.lineWidth = 1;
    drawWaveform(ctx, audioBuffer, state);

    // Draw selection
    if (selection.isActive) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      const startX = selection.start * state.config.pixelsPerSecond;
      const endX = selection.end * state.config.pixelsPerSecond;
      ctx.fillRect(startX, 0, endX - startX, canvas.height);
    }

    // Draw playhead
    ctx.strokeStyle = state.config.progressColor;
    ctx.lineWidth = 2;
    const playheadX = currentPosition * state.config.pixelsPerSecond;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
  }, [audioBuffer, state, selection, currentPosition]);

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    buffer: AudioBuffer,
    state: unknown
  ) => {
    const rawData = buffer.getChannelData(0);
    const samples = rawData.length;
    const blockSize = Math.floor(samples / (state.config.width * state.config.pixelsPerSecond));

    ctx.beginPath();
    ctx.moveTo(0, state.config.height / 2);

    for (let i = 0; i < samples; i += blockSize) {
      const blockEnd = Math.min(i + blockSize, samples);
      let sum = 0;

      for (let j = i; j < blockEnd; j++) {
        sum += Math.abs(rawData[j]);
      }

      const avg = sum / (blockEnd - i);
      const canvasHeight = avg * state.config.height;
      const x = (i / blockSize / state.config.pixelsPerSecond) % state.config.width;
      const y = state.config.height / 2 - canvasHeight / 2;

      ctx.lineTo(x, y);
    }

    ctx.stroke();
  };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <canvas
        ref={canvasRef}
        width={state.config.width}
        height={state.config.height}
        className="w-full cursor-crosshair"
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const startTime = x / state.config.pixelsPerSecond;
          onSelectionChange(startTime, startTime);
        }}
      />
    </Card>
  );
};

// ============================================================================
// QUICK START: Integration with Zustand store
// ============================================================================

