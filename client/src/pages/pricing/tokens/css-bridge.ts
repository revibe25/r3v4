// tokens/css-bridge.ts
import { SEMANTIC } from './semantic';

export function injectTokenCSS() {
  const root = document.documentElement;
  
  root.style.setProperty('--bg-base', SEMANTIC.background.base);
  root.style.setProperty('--bg-surface', SEMANTIC.background.surface);
  root.style.setProperty('--text-body', SEMANTIC.text.body);
  root.style.setProperty('--accent-cyan', SEMANTIC.accent.cyan);
  root.style.setProperty('--status-error-soft', '#ff8888');
  
  // Plan accents as CSS variables (allows runtime overrides)
  root.style.setProperty('--plan-creator-accent', PLAN_ACCENT.creator);
}
