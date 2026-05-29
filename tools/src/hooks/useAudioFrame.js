import { useEffect, useState } from "react";

export function useAudioFrame(engineRef) {
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    let lastVersion = 0;

    function poll() {
      const store = engineRef.current?.store;

      if (!store) {
        requestAnimationFrame(poll);
        return;
      }

      if (store.hasUpdate(lastVersion)) {
        lastVersion = store.version;
        setFrame(store.read());
      }

      requestAnimationFrame(poll);
    }

    poll();
  }, [engineRef]);

  return frame;
}
