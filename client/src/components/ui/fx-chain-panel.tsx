import React from 'react';
import { Sliders } from 'lucide-react';

type FXType = 'EQ' | 'Compressor' | 'Delay' | 'Reverb' | 'Distortion';

export interface FXUnit {
  id: string;
  type: FXType;
  bypassed: boolean;
  params?: Record<string, number>;
}

interface FXChainPanelProps {
  selectedTrackId: string | null;
  selectedTrackName?: string;
  fxUnits: FXUnit[];
  onAddFX: (type: FXType) => void;
  onToggleBypass: (fxId: string) => void;
  onRemoveFX?: (fxId: string) => void;
  onReorderFX?: (oldIndex: number, newIndex: number) => void;
}

const FXTypeInfo: Record<FXType, string> = {
  'EQ': 'Low • Mid • High',
  'Compressor': 'Threshold • Ratio • Attack',
  'Delay': 'Time • Feedback • Mix',
  'Reverb': 'Room • Damping • Mix',
  'Distortion': 'Drive • Tone • Mix'
};

export const FXChainPanel: React.FC<FXChainPanelProps> = ({
  selectedTrackId,
  selectedTrackName,
  fxUnits,
  onAddFX,
  onToggleBypass,
  onRemoveFX
}) => {
  return (
    <div className="w-64 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-white">FX Chain</span>
        </div>
      </div>

      {selectedTrackId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Track Name */}
          {selectedTrackName && (
            <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
              Track: <span className="text-white font-medium">{selectedTrackName}</span>
            </div>
          )}

          {/* FX Units List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {fxUnits.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No effects added
              </div>
            ) : (
              fxUnits.map((fx, index) => (
                <div
                  key={fx.id}
                  className="bg-muted rounded-lg p-3 border border-border hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                      <span className="text-sm font-medium text-white">{fx.type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleBypass(fx.id)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          fx.bypassed
                            ? 'bg-muted text-muted-foreground hover:bg-accent'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {fx.bypassed ? 'Bypassed' : 'Active'}
                      </button>
                      {onRemoveFX && (
                        <button
                          onClick={() => onRemoveFX(fx.id)}
                          className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground hover:bg-red-600 hover:text-white transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {FXTypeInfo[fx.type]}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add FX Buttons */}
          <div className="border-t border-border p-4 space-y-2">
            <div className="text-xs text-gray-500 mb-2">Add Effect:</div>
            {(['EQ', 'Compressor', 'Delay', 'Reverb', 'Distortion'] as FXType[]).map((fxType) => (
              <button
                key={fxType}
                onClick={() => onAddFX(fxType)}
                className="w-full py-2 bg-muted hover:bg-muted text-white text-sm rounded transition-colors"
              >
                + {fxType}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-4 text-center">
          Select a track to add effects
        </div>
      )}
    </div>
  );
};

export default FXChainPanel;
