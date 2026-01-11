import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Mic, MicOff } from 'lucide-react';

interface MicrophoneInputProps {
  onAudioData?: (data: Float32Array) => void;
}

export function MicrophoneInput({ onAudioData }: MicrophoneInputProps) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [inputGain, setInputGain] = useState([75]);
  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakTimeoutRef = useRef<number | null>(null);

  // Get available audio input devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = deviceList.filter(device => device.kind === 'audioinput');
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting audio devices:', error);
      }
    };

    getDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, [selectedDevice]);

  // Update level meter
  useEffect(() => {
    if (!isActive || !analyserRef.current) return;

    const updateLevel = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const db = 20 * Math.log10(rms);
      const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.67)); // Map -60db to 0db -> 0 to 100

      setLevel(normalizedLevel);

      // Update peak level
      if (normalizedLevel > peakLevel) {
        setPeakLevel(normalizedLevel);

        // Reset peak after 2 seconds
        if (peakTimeoutRef.current) {
          clearTimeout(peakTimeoutRef.current);
        }
        peakTimeoutRef.current = window.setTimeout(() => {
          setPeakLevel(0);
        }, 2000);
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (peakTimeoutRef.current) {
        clearTimeout(peakTimeoutRef.current);
      }
    };
  }, [isActive, peakLevel]);

  const startMicrophone = async () => {
    try {
      // Create audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Get microphone stream
      const constraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Create audio nodes
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const gainNode = audioContextRef.current.createGain();
      const analyser = audioContextRef.current.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      // Set initial gain
      gainNode.gain.value = inputGain[0] / 100;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(analyser);

      if (!isMuted) {
        gainNode.connect(audioContextRef.current.destination);
      }

      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;

      setIsActive(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    setIsActive(false);
    setLevel(0);
    setPeakLevel(0);
  };

  const toggleMute = () => {
    if (!gainNodeRef.current || !audioContextRef.current) return;

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      gainNodeRef.current.disconnect(audioContextRef.current.destination);
    } else {
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
  };

  const handleGainChange = (value: number[]) => {
    setInputGain(value);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value[0] / 100;
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    if (isActive) {
      stopMicrophone();
      setTimeout(() => startMicrophone(), 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const getLevelColor = (level: number) => {
    if (level > 85) return 'bg-red-500';
    if (level > 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Microphone Input</h3>
        <div className="flex gap-2">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMute}
            disabled={!isActive}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={isActive ? stopMicrophone : startMicrophone}
          >
            {isActive ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Input Device</label>
        <Select value={selectedDevice} onValueChange={handleDeviceChange} disabled={isActive}>
          <SelectTrigger>
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {devices.map(device => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-muted-foreground">Input Gain</label>
          <span className="text-xs font-medium">{inputGain[0]}%</span>
        </div>
        <Slider
          value={inputGain}
          onValueChange={handleGainChange}
          min={0}
          max={150}
          step={1}
          disabled={!isActive}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Input Level</label>
        <div className="relative h-6 bg-muted/20 rounded-lg overflow-hidden">
          {/* Level meter bars */}
          <div className="absolute inset-0 flex gap-0.5 p-1">
            {Array.from({ length: 40 }).map((_, i) => {
              const barLevel = (i / 40) * 100;
              const isActive = barLevel <= level;
              const isPeak = barLevel <= peakLevel && barLevel > level;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-colors duration-75 ${
                    isActive
                      ? getLevelColor(barLevel)
                      : isPeak
                      ? 'bg-red-400'
                      : 'bg-muted/40'
                  }`}
                />
              );
            })}
          </div>

          {/* dB markers */}
          <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
            <span className="text-[10px] text-muted-foreground font-mono">-60</span>
            <span className="text-[10px] text-muted-foreground font-mono">-40</span>
            <span className="text-[10px] text-muted-foreground font-mono">-20</span>
            <span className="text-[10px] text-muted-foreground font-mono">0</span>
          </div>
        </div>

        {level > 85 && (
          <p className="text-xs text-red-500 font-medium">⚠ Input clipping - reduce gain</p>
        )}
      </div>

      {!isActive && (
        <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
          <p className="font-medium mb-1">💡 Quick Start:</p>
          <p>1. Select your microphone device</p>
          <p>2. Click "Start" to enable input</p>
          <p>3. Adjust gain to reach green/yellow levels</p>
          <p>4. Avoid red levels to prevent distortion</p>
        </div>
      )}
    </div>
  );
}