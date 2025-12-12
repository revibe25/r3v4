import { useRef, useState } from 'react';
import { PIANO_KEYS, PIANO_NOTES } from '@/lib/audio-engine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';

interface PianoKeysProps {
  keys: { sample: AudioBuffer | null; name: string; note: string; isActive: boolean }[];
  onTrigger: (index: number) => void;
  onAssignSample: (keyIndex: number, buffer: AudioBuffer, name: string) => void;
  loadSample: (file: File) => Promise<AudioBuffer | null>;
}

export function PianoKeys({ keys, onTrigger, onAssignSample, loadSample }: PianoKeysProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedKey, setSelectedKey] = useState<string>('0');
  const [uploadedFile, setUploadedFile] = useState<{ buffer: AudioBuffer; name: string } | null>(null);

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

  const whiteKeyIndices = [0, 2, 4, 5, 7, 9, 11];
  const blackKeyIndices = [1, 3, 6, 8, 10];
  const blackKeyPositions = [1, 2, 4, 5, 6];

  return (
    <section aria-label="Piano" className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Piano Octave (C4–B4, Z S X D C V G B H N M ,)
      </h3>

      <div className="relative flex justify-center py-4">
        <div className="relative flex">
          {whiteKeyIndices.map((keyIdx, i) => {
            const key = keys[keyIdx];
            return (
              <button
                key={keyIdx}
                data-testid={`piano-key-${keyIdx}`}
                onClick={() => onTrigger(keyIdx)}
                className={`
                  relative w-9 md:w-11 h-28 md:h-32 rounded-b-lg
                  flex flex-col items-center justify-end pb-2
                  text-[10px] font-bold z-10 border-x border-b
                  transition-all duration-100
                  ${key.isActive
                    ? 'bg-gradient-to-b from-primary to-white text-primary shadow-inner shadow-primary/40'
                    : 'bg-gradient-to-b from-gray-100 to-white text-gray-600 border-gray-200 hover:from-gray-50'
                  }
                  ${i > 0 ? '-ml-px' : ''}
                `}
              >
                <span>{key.note.replace('#', '')}</span>
                <span className="text-[8px] opacity-50">{PIANO_KEYS[keyIdx]?.toUpperCase()}</span>
              </button>
            );
          })}

          {blackKeyIndices.map((keyIdx, i) => {
            const key = keys[keyIdx];
            const leftOffset = blackKeyPositions[i] * 36 - 11;
            return (
              <button
                key={keyIdx}
                data-testid={`piano-key-${keyIdx}`}
                onClick={() => onTrigger(keyIdx)}
                style={{ left: `${leftOffset}px` }}
                className={`
                  absolute w-6 md:w-7 h-16 md:h-20 rounded-b-md
                  flex flex-col items-center justify-end pb-1
                  text-[8px] font-bold z-20
                  transition-all duration-100
                  ${key.isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-gray-900 text-gray-300 border border-gray-700 hover:bg-gray-800'
                  }
                `}
              >
                <span>{key.note}</span>
                <span className="text-[7px] opacity-50">{PIANO_KEYS[keyIdx]?.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
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
          <SelectTrigger className="w-32" data-testid="select-key-target">
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
