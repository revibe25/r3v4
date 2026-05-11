// client/src/tokens.ts
export function injectTokenCSS() {
  const css = `
    :root {
      --color-background: #0a0a0f;
      --color-surface: #12121a;
      --color-surface-elevated: #1a1a25;
      --color-border: rgba(255, 255, 255, 0.08);
      --color-text: #e2e2e8;
      --color-text-muted: #8a8a9a;
      --color-primary: #6366f1;
      --color-primary-glow: rgba(99, 102, 241, 0.3);
      --color-success: #22c55e;
      --color-warning: #f59e0b;
      --color-error: #ef4444;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 16px;
      --nav-height: 64px;
    }
  `;

  let style = document.getElementById("theme-tokens") as HTMLStyleElement | null;
  if (style) {
    style.textContent = css;
  } else {
    style = document.createElement("style");
    style.id = "theme-tokens";
    style.textContent = css;
    document.head.appendChild(style);
  }
}