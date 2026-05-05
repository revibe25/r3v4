import './index.css';
import { useAuthStore } from "./store/auth-store"
import './styles/theme.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerAudioInitTriggers } from './utils/audio';

// ── Audio gesture gate ────────────────────────────────────────────────────────
// Attaches passive document listeners that resume the Web Audio context on
// the first user interaction. Must run BEFORE render so the listener is active
// before any component mounts. Does NOT create an AudioContext here.

// ── Hydrate auth from persisted token (after all imports) ───────────────────
useAuthStore.getState().initAuth();
registerAudioInitTriggers();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
