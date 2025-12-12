import { useRef, useState } from 'react';
import { PAD_KEYS } from '@/lib/audio-engine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';

interface DrumPadsProps {
  pads: { sample: AudioBuffer | null; name: string; isActive: boolean }[];
  onTrigger: (index: number) => void;
  onAssignSample: (padIndex: number, buffer: AudioBuffer, name: string) => void;
  loadSample: (file: File) => Promise<AudioBuffer | null>;
}

export function DrumPads({ pads, onTrigger, onAssignSample, loadSample }: DrumPadsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPad, setSelectedPad] = useState<string>('0');
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
      onAssignSample(parseInt(selectedPad), uploadedFile.buffer, uploadedFile.name);
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section aria-label="Drum pads" className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Drum Pads (Q W E R T Y U I | A S D F G H J K)
      </h3>
      
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
        {pads.map((pad, i) => (
          <button
            key={i}
            data-testid={`pad-${i}`}
            onClick={() => onTrigger(i)}
            className={`
              relative h-14 md:h-16 rounded-lg font-bold text-xs md:text-sm
              transition-all duration-150 select-none
              flex flex-col items-center justify-center gap-0.5
              border border-border/30
              ${pad.isActive
                ? 'bg-gradient-to-b from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/25 -translate-y-0.5 scale-[1.02]'
                : 'bg-gradient-to-b from-card/80 to-card text-foreground/90 hover:from-card hover:to-muted/50'
              }
            `}
          >
            <div className="absolute left-2 right-2 top-1.5 h-1.5 rounded-full bg-black/20 overflow-hidden">
              <div 
                className={`h-full transition-all duration-75 bg-gradient-to-r from-primary to-chart-2 ${pad.isActive ? 'w-full' : 'w-0'}`}
              />
            </div>
            <span className="mt-1">{i + 1}</span>
            <span className="text-[10px] opacity-60">{PAD_KEYS[i].toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-pad-upload"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-upload-pad"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>

        <Select value={selectedPad} onValueChange={setSelectedPad}>
          <SelectTrigger className="w-32" data-testid="select-pad-target">
            <SelectValue placeholder="Select pad" />
          </SelectTrigger>
          <SelectContent>
            {pads.map((_, i) => (
              <SelectItem key={i} value={i.toString()}>
                Pad {i + 1} ({PAD_KEYS[i].toUpperCase()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleAssign}
          disabled={!uploadedFile}
          data-testid="button-assign-pad"
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
