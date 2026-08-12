export class SidechainRouterState {
    constructor(audioContext) {
        this.connections = new Map();
        this.audioContext = audioContext;
    }
    createSidechain(config, sourceNode, targetVST) {
        const connectionId = `${config.sourceChannelId}_to_${config.targetVSTId}`;
        const sidechainGain = this.audioContext.createGain();
        sidechainGain.gain.setTargetAtTime(config.gainCompensation, this.audioContext.currentTime, 0.015);
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 2048;
        sourceNode.connect(sidechainGain);
        sidechainGain.connect(analyzer);
        const connection = {
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
    enableConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        connection.enabled = true;
        connection.sidechainGain.gain.setTargetAtTime(connection.config.gainCompensation, this.audioContext.currentTime, 0.015);
    }
    disableConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        connection.enabled = false;
        connection.sidechainGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.015);
    }
    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        connection.sidechainGain.disconnect();
        connection.analyzer.disconnect();
        this.connections.delete(connectionId);
    }
    getSidechainLevel(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return 0;
        const dataArray = new Uint8Array(connection.analyzer.frequencyBinCount);
        connection.analyzer.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / dataArray.length);
    }
    setSidechainGain(connectionId, gain) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        connection.config.gainCompensation = gain;
        if (connection.enabled) {
            connection.sidechainGain.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);
        }
    }
    getAllConnections() {
        return Array.from(this.connections.values());
    }
    dispose() {
        this.connections.forEach((_, id) => this.removeConnection(id));
        this.connections.clear();
    }
}
export { SidechainRouterState as SidechainRouter };
