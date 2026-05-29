import { useAudioEngine } from '../audio/hooks/useAudioEngine';

export default function AudioTest() {
  const { start, ready, energy } = useAudioEngine();

  if (!ready) {
    return (
      <>
          <header className="ag-header">
            <div className="ag-header-top">
              <div className="ag-wordmark-block">
                <div className="ag-wordmark" data-testid="text-title">
                  R3<span className="ag-wordmark-slash">/</span>NATIVE
                </div>
                <div className="ag-wordmark-sub">Audio · Device Testing</div>
              </div>
            </div>
          </header>

      <div style={{ padding: 20 }}>
        <button onClick={start}>Start Audio</button>
      </div>
          </>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Audio Engine Running</h2>
      <p>Energy: {energy.toFixed(4)}</p>
    </div>
  );
}
