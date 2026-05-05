import { useEffect, useState } from "react";
// Pass in a function that returns the audio level [0,1]
export function useAudioReactivity(getLevel: () => number) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let _smoothed = 0; let raf: number;
    const _loop = () => { const _raw = getLevel();
      smoothed = smoothed * 0.85 + raw * 0.15;
      setLevel(smoothed);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);
  return level;
}
