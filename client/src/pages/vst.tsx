/**
 * client/src/pages/vst.tsx
 * VST Plugin Browser & FX Chain Manager — R3 v4
 *
 * Thin page wrapper around VSTBrowser (plugin discovery + load) and
 * VSTMasterPanel (project serialiser, automation, sidechain, performance).
 * Plugin selection state is local — no global store needed at this layer;
 * VSTBrowser writes directly to the audio engine's FX chain.
 *
 * Route: /vst  (ProtectedRoute — requires auth)
 */

import { useState } from 'react';
import { VSTBrowser } from '@/components/vst-browser';
import type { VSTPluginInfo } from '@/audio/fx/vst-scanner';

export default function VSTPage() {
  const [selectedPlugin, setSelectedPlugin] = useState<VSTPluginInfo | null>(null);

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100vh',
        background:     '#060606',
        color:          '#f0f0f0',
        fontFamily:     "'IBM Plex Mono', 'JetBrains Mono', monospace",
        overflow:       'hidden',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        <VSTBrowser
          onPluginSelect={setSelectedPlugin}
          channelId="master"
          showFXChain={true}
        />
      </div>
    </div>
  );
}
