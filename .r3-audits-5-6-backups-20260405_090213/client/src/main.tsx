import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { registerAudioInitTriggers } from './utils/audio';
import './index.css';

// ── Audio gesture gate ────────────────────────────────────────────────────────
// Attaches passive document listeners that resume the Web Audio context on
// the first user interaction. Must run BEFORE render so the listener is active
// before any component mounts. Does NOT create an AudioContext here.
registerAudioInitTriggers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
