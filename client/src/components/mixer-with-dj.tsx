// @ts-nocheck
import React, { useCallback, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Plus } from "lucide-react";
import { DJControls } from "./dj-controls";
import { ChannelStrip } from "./channel-strip";
import { SpectrumAnalyzer } from "./SpectrumAnalyzer";
import { VUMeter } from "./vumeter";
import { Slider } from "@/components/ui/slider";
import { defaultChannel } from "./utils";
import type { ChannelState, MasterState } from "./types";

export default function MixerWithDJ() {
  // same logic as before
  const [channels, setChannels] = useState<ChannelState[]>(() => [
    defaultChannel(1),
    defaultChannel(2),
    defaultChannel(3),
    defaultChannel(4),
  ]);

  const [master, setMaster] = useState<MasterState>({
    mainFader: 85,
    headphoneFader: 70,
    monitoring: "stereo",
    masterCompression: 1.5,
    masterLimiter: false,
    recording: false,
    streamActive: false,
  });

  const [filterVal, setFilterVal] = useState(0.5);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [crossfade, setCrossfade] = useState(0);

  const _updateChannel = useCallback((id: number, updates: Partial<ChannelState>) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const _duplicateChannel = (id: number) => {
    setChannels((prev) => {
      const _base = prev.find((c) => c.id === id);
      if (!base) return prev;
      const _newId = Math.max(...prev.map((p) => p.id)) + 1;
      return [...prev, { ...base, id: newId, name: `${base.name} Copy` }];
    });
  };

  const _deleteChannel = (id: number) => setChannels((prev) => prev.filter((c) => c.id !== id));

  useEffect(() => {
    setChannels((prev) => prev.map((c) => ({ ...c, reverb: Math.round(filterVal * 50) })));
  }, [filterVal]);

  return (
    <div className="p-6 min-h-screen bg-background">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">Mixer Console</h1>
          <p className="text-sm text-muted-foreground">Dynamic Accent + shadcn Theme</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="w-5 h-5" />
            <span>{master.mainFader}%</span>
          </div>
          <Button onClick={() => setChannels((p) => [...p, defaultChannel(p.length + 1)])}>
            <Plus className="w-4 h-4 mr-2" /> Add Channel
          </Button>
        </div>
      </header>

      <section className="mb-6">
        <DJControls
          filterVal={filterVal}
          pitchSemitones={pitchSemitones}
          crossfade={crossfade}
          onFilterChange={setFilterVal}
          onPitchChange={setPitchSemitones}
          onCrossfadeChange={setCrossfade}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {channels.map((ch) => (
          <ChannelStrip
            key={ch.id}
            channel={ch}
            onChange={(u) => updateChannel(ch.id, u)}
            onDuplicate={() => duplicateChannel(ch.id)}
            onDelete={() => deleteChannel(ch.id)}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border/40">
          <CardHeader>
            <CardTitle>Master</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Main Fader</span>
                  <span className="font-mono">{master.mainFader}%</span>
                </div>
                <Slider
                  value={[master.mainFader]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setMaster((s) => ({ ...s, mainFader: v }))}
                />
              </div>
              <div className="w-48">
                <SpectrumAnalyzer active={true} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/40">
          <CardHeader>
            <CardTitle>Master Output</CardTitle>
          </CardHeader>
          <CardContent>
            <VUMeter
              level={channels.reduce((a, b) => a + b.level, 0) / Math.max(1, channels.length)}
              peakLevel={channels.reduce((a, b) => Math.max(a, b.peakLevel), 0)}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
