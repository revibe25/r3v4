import { useRef, useState } from 'react';
import { PIANO_KEYS, PIANO_NOTES } from '@/lib/audio-engine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ChevronUp, ChevronDown } from 'lucide-react';

interface PianoKeysProps {
  keys: { sample: AudioBuffer | null; name: string; note: string; isActive: boolean }[];
  onTrigger: (index: number, octaveShift: number) => void;
  onAssignSample: (keyIndex: number, buffer: AudioBuffer, name: string) => void;
  loadSample: (file: File) => Promise<AudioBuffer | null>;
}

export function PianoKeys({ keys, onTrigger, onAssignSample, loadSample }: PianoKeysProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedKey, setSelectedKey] = useState<string>('0');
  const [uploadedFile, setUploadedFile] = useState<{ buffer: AudioBuffer; name: string } | null>(null);
  const [octaveShift, setOctaveShift] = useState<number>(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await loadSample(file);
    if (buffer) {
      setUploadedFile({ buffer, name: file.name });
    }
  };

  const handleAssign = () => {
    if (uploadedFile) {
      onAssignSample(parseInt(selectedKey), uploadedFile.buffer, uploadedFile.name);
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOctaveUp = () => {
    if (octaveShift < 3) {
      setOctaveShift(octaveShift + 1);
    }
  };

  const handleOctaveDown = () => {
    if (octaveShift > -3) {
      setOctaveShift(octaveShift - 1);
    }
  };

  const getOctaveLabel = (baseOctave: number) => {
    const shiftedOctave = baseOctave + octaveShift;
    return `C${shiftedOctave}–B${shiftedOctave}`;
  };

  const renderOctave = (startIdx: number, baseOctave: number, keyLabels: string[]) => {
    const whiteKeyIndices = [0, 2, 4, 5, 7, 9, 11].map(i => i + startIdx);
    const blackKeyIndices = [1, 3, 6, 8, 10].map(i => i + startIdx);
    const blackKeyPositions = [1, 2, 4, 5, 6];

    if (!keys[startIdx]) {
      return null;
    }

    return (
      <div className="flex-1">
        <h4 className="text-xs font-medium text-muted-foreground mb-2 text-center">
          {getOctaveLabel(baseOctave)}
        </h4>
        <div className="relative flex justify-center py-4">
          <div className="relative flex">
            {whiteKeyIndices.map((keyIdx, i) => {
              const key = keys[keyIdx];
              if (!key) return null;
              const keyLabel = keyLabels[whiteKeyIndices.indexOf(keyIdx)];
              return (
                <button
                  key={keyIdx}
                  data-testid={`piano-key-${keyIdx}`}
                  onClick={() => onTrigger(keyIdx, octaveShift)}
                  className={`
                    relative w-8 md:w-10 h-24 md:h-28 rounded-b-lg
                    flex flex-col items-center justify-end pb-2
                    text-[9px] font-bold z-10 border-x border-b
                    transition-all duration-100
                    ${key.isActive
                      ? 'bg-gradient-to-b from-primary to-white text-primary shadow-inner shadow-primary/40'
                      : 'bg-gradient-to-b from-gray-100 to-white text-gray-600 border-gray-200 hover:from-gray-50'
                    }
                    ${i > 0 ? '-ml-px' : ''}
                  `}
                >
                  <span>{key.note.replace('#', '').charAt(0)}{baseOctave + octaveShift}</span>
                  <span className="text-[7px] opacity-50">{keyLabel}</span>
                </button>
              );
            })}

            {blackKeyIndices.map((keyIdx, i) => {
              const key = keys[keyIdx];
              if (!key) return null;
              const leftOffset = blackKeyPositions[i] * 32 - 10;
              const keyLabel = keyLabels[blackKeyIndices.indexOf(keyIdx) + 7];
              return (
                <button
                  key={keyIdx}
                  data-testid={`piano-key-${keyIdx}`}
                  onClick={() => onTrigger(keyIdx, octaveShift)}
                  style={{ left: `${leftOffset}px` }}
                  className={`
                    absolute w-5 md:w-6 h-14 md:h-16 rounded-b-md
                    flex flex-col items-center justify-end pb-1
                    text-[7px] font-bold z-20
                    transition-all duration-100
                    ${key.isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : 'bg-gray-900 text-gray-300 border border-gray-700 hover:bg-gray-800'
                    }
                  `}
                >
                  <span>{key.note.replace('4', `${baseOctave + octaveShift}`)}</span>
                  <span className="text-[6px] opacity-50">{keyLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const lowerOctaveLabels = ['Z', 'S', 'X', 'D', 'C', 'V', 'G', 'B', 'H', 'N', 'M', ','];
  const upperOctaveLabels = ['1', '!', '2', '@', '3', '4', '$', '5', '%', '6', '^', '7'];

  return (
    <section aria-label="Piano" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Piano Keyboard (2 Octaves)
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Octave Shift:</span>
          <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOctaveDown}
              disabled={octaveShift <= -3}
              className="h-7 w-7 p-0"
              title="Shift down one octave"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">
              {octaveShift > 0 ? `+${octaveShift}` : octaveShift}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOctaveUp}
              disabled={octaveShift >= 3}
              className="h-7 w-7 p-0"
              title="Shift up one octave"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {renderOctave(0, 4, lowerOctaveLabels)}
        {renderOctave(12, 5, upperOctaveLabels)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-key-upload"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-upload-key"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>

        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger className="w-40" data-testid="select-key-target">
            <SelectValue placeholder="Select key" />
          </SelectTrigger>
          <SelectContent>
            {PIANO_NOTES.map((note, i) => (
              <SelectItem key={i} value={i.toString()}>
                {note} ({PIANO_KEYS[i]?.toUpperCase()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleAssign}
          disabled={!uploadedFile}
          data-testid="button-assign-key"
        >
          Assign
        </Button>

        {uploadedFile && (
          <span className="text-xs text-muted-foreground">{uploadedFile.name}</span>
        )}
      </div>
    </section>
  );
}