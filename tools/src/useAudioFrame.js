import { useEffect, useState } from "react";

export function useAudioFrame() {
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    let running = true;

    function poll() {
      if (!running) return;

      const f = window.__AUDIO_FRAME__;
      if (f) setFrame(f);

      requestAnimationFrame(poll);
    }

    poll();

    return () => {
      running = false;
    };
  }, []);

  return frame;
}
