export function enforceThemeUsage(className?: string) {
  if (process.env.NODE_ENV !== "development") return;

  if (!className) return;

  const violations = [
    /bg-black/,
    /text-white/,
    /#[0-9a-fA-F]{3,8}/,
    /var\(--color-[^)]+\)/,
  ];

  for (const rule of violations) {
    if (rule.test(className)) {
      console.error(
        "[THEME VIOLATION] Raw styling detected:",
        className
      );
    }
  }
}
