// client/src/audio/fx/vst-sidechain.ts
import { VSTFXNode } from './vst-fx-node';
import type { SidechainConfig } from '@/types/audio';

interface SidechainConnection {
  id: string;
  config: SidechainConfig;
  sidechainGain: GainNode;
  analyzer: AnalyserNode;
  enabled: boolean;
  sourceNode: AudioNode;
  targetVST: VSTFXNode;
}

export class SidechainRouterState {
  private audioContext: AudioContext;
  private connections: Map<string, SidechainConnection> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  createSidechain(
    config: SidechainConfig,
    sourceNode: AudioNode,
    targetVST: VSTFXNode
  ): string {
    const connectionId = `${config.sourceChannelId}_to_${config.targetVSTId}`;

    const sidechainGain = this.audioContext.createGain();
    sidechainGain.gain.setTargetAtTime(config.gainCompensation, this.audioContext.currentTime, 0.015);

    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 2048;

    sourceNode.connect(sidechainGain);
    sidechainGain.connect(analyzer);

    const connection: SidechainConnection = {
      id: connectionId,
      config,
      sidechainGain,
      analyzer,
      enabled: config.enabled,
      sourceNode,
      targetVST,
    };

    this.connections.set(connectionId, connection);

    if (config.enabled) {
      this.enableConnection(connectionId);
    }

    return connectionId;
  }

  enableConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    connection.enabled = true;
    connection.sidechainGain.gain.setTargetAtTime(connection.config.gainCompensation, this.audioContext.currentTime, 0.015);
  }

  disableConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    connection.enabled = false;
    connection.sidechainGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.015);
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    connection.sidechainGain.disconnect();
    connection.analyzer.disconnect();
    this.connections.delete(connectionId);
  }

  getSidechainLevel(connectionId: string): number {
    const connection = this.connections.get(connectionId);
    if (!connection) return 0;

    const dataArray = new Uint8Array(connection.analyzer.frequencyBinCount);
    connection.analyzer.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }

    return Math.sqrt(sum / dataArray.length);
  }

  setSidechainGain(connectionId: string, gain: number): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    connection.config.gainCompensation = gain;
    if (connection.enabled) {
      connection.sidechainGain.gain.setTargetAtTime(
        gain,
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  getAllConnections(): SidechainConnection[] {
    return Array.from(this.connections.values());
  }

  dispose(): void {
    this.connections.forEach((_, id) => this.removeConnection(id));
    this.connections.clear();
  }
}

export { SidechainRouterState as SidechainRouter };
