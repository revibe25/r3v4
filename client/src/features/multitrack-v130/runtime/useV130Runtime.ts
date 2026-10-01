import {
  useEffect,
  type RefObject,
} from 'react';

import { useDAWEngine } from '@/hooks/useDAWEngine';
import { useDAWStore } from '@/hooks/useDAWStore';

function qs<T extends Element>(
  root: HTMLElement,
  selector: string,
): T | null {
  return root.querySelector<T>(selector);
}

function setPressed(
  el: Element | null,
  pressed: boolean,
): void {
  el?.setAttribute(
    'aria-pressed',
    String(pressed),
  );
}

function setText(
  el: Element | null,
  value: string,
): void {
  if (el) {
    el.textContent = value;
  }
}

function positionToClock(
  position: number,
  numerator: number,
): {
  bar: number;
  beat: number;
  tick: number;
} {
  const safe =
    Number.isFinite(position)
      ? Math.max(0, position)
      : 0;

  const safeNumerator =
    Number.isFinite(numerator) &&
    numerator > 0
      ? numerator
      : 4;

  const barIndex =
    Math.floor(
      safe / safeNumerator,
    );

  const beatIndex =
    Math.floor(
      safe % safeNumerator,
    );

  const tick =
    Math.floor(
      (safe % 1) * 1000,
    );

  return {
    bar: barIndex + 1,
    beat: beatIndex + 1,
    tick,
  };
}

function formatPosition(
  position: number,
): string {
  const safe =
    Number.isFinite(position)
      ? Math.max(0, position)
      : 0;

  const totalMs =
    Math.round(safe * 1000);

  const hours =
    Math.floor(
      totalMs / 3_600_000,
    );

  const minutes =
    Math.floor(
      (totalMs % 3_600_000) / 60_000,
    );

  const seconds =
    Math.floor(
      (totalMs % 60_000) / 1000,
    );

  const milliseconds =
    totalMs % 1000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    `${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`,
  ].join(':');
}

export function useV130Runtime(
  rootRef: RefObject<HTMLElement | null>,
): void {
  const {
    togglePlay,
    stop,
    toggleRecord,
    seekTo,
    resumeContext,
    contextState,
  } = useDAWEngine();

  useEffect(() => {
    const root =
      rootRef.current;

    if (!root) {
      return;
    }

    const store =
      useDAWStore;

    const playButton =
      qs<HTMLButtonElement>(
        root,
        '#bPlay',
      );

    const stopButton =
      qs<HTMLButtonElement>(
        root,
        '#bStop',
      );

    const recordButton =
      qs<HTMLButtonElement>(
        root,
        '#bRec',
      );

    const bpmInput =
      qs<HTMLInputElement>(
        root,
        '#bpm',
      );

    const loopButton =
      qs<HTMLButtonElement>(
        root,
        '#tbLoop',
      );

    const timeline =
      qs<HTMLCanvasElement>(
        root,
        '#cvO',
      );

    const engineButton =
      qs<HTMLButtonElement>(
        root,
        '#engBtn',
      );

    const engineText =
      qs<HTMLElement>(
        root,
        '#engTxt',
      );

    const engineFooter =
      qs<HTMLElement>(
        root,
        '#fEng',
      );

    const timeOutput =
      qs<HTMLElement>(
        root,
        '#tTime',
      );

    const barOutput =
      qs<HTMLElement>(
        root,
        '#tBar',
      );

    const beatOutput =
      qs<HTMLElement>(
        root,
        '#tBeat',
      );

    const tickOutput =
      qs<HTMLElement>(
        root,
        '#tTick',
      );

    const bpmDisplay =
      qs<HTMLElement>(
        root,
        '#pBpm',
      );

    if (
      !playButton ||
      !stopButton ||
      !recordButton
    ) {
      return;
    }

    const onPlay = () => {
      togglePlay();
    };

    const onStop = () => {
      stop();
    };

    const onRecord = () => {
      toggleRecord();
    };

    const onEngine = () => {
      void resumeContext()
        .then(() => {
          sync();
        })
        .catch(() => {
          sync();
        });
    };

    const onBpmChange = () => {
      if (!bpmInput) {
        return;
      }

      const value =
        Number(
          bpmInput.value,
        );

      if (!Number.isFinite(value)) {
        return;
      }

      store
        .getState()
        .setBpm(value);
    };

    const onLoop = () => {
      const state =
        store.getState();

      if (state.loopEnabled) {
        state.setLoopEnabled(false);
        return;
      }

      const start =
        Number.isFinite(
          state.loopStart,
        )
          ? state.loopStart
          : 0;

      const end =
        Number.isFinite(
          state.loopEnd,
        ) &&
        state.loopEnd > start
          ? state.loopEnd
          : start + 4;

      state.setLoopPoints(
        start,
        end,
      );

      state.setLoopEnabled(
        true,
      );
    };

    const onTimelinePointer = (
      event: PointerEvent,
    ) => {
      if (!timeline) {
        return;
      }

      const rect =
        timeline.getBoundingClientRect();

      if (rect.width <= 0) {
        return;
      }

      const x =
        Math.max(
          0,
          Math.min(
            rect.width,
            event.clientX -
              rect.left,
          ),
        );

      const normalized =
        x / rect.width;

      // Frozen V130 contract:
      // 48 bars × 4 beats/bar.
      const targetBeat =
        normalized * 48 * 4;

      seekTo(
        Math.max(
          0,
          targetBeat,
        ),
      );
    };

    const sync =
      (
        state = store.getState(),
      ) => {
        setPressed(
          playButton,
          state.playing,
        );

        setPressed(
          recordButton,
          state.recording,
        );

        setPressed(
          loopButton,
          state.loopEnabled,
        );

        if (bpmInput) {
          bpmInput.value =
            state.bpm.toFixed(2);
        }

        setText(
          bpmDisplay,
          `${state.bpm.toFixed(2)} BPM`,
        );

        const clock =
          positionToClock(
            state.position,
            state.timeSignature[0],
          );

        setText(
          barOutput,
          String(clock.bar),
        );

        setText(
          beatOutput,
          String(clock.beat),
        );

        setText(
          tickOutput,
          String(
            clock.tick,
          ).padStart(
            3,
            '0',
          ),
        );

        setText(
          timeOutput,
          formatPosition(
            state.position,
          ),
        );

        const audioRunning =
          contextState() === 'running';

        setText(
          engineText,
          audioRunning
            ? 'Running'
            : 'Offline',
        );

        engineButton?.classList.toggle(
          'run',
          audioRunning,
        );

        setText(
          engineFooter,
          audioRunning
            ? 'Audio engine: running'
            : 'Audio engine: offline',
        );
      };

    playButton.addEventListener(
      'click',
      onPlay,
    );

    stopButton.addEventListener(
      'click',
      onStop,
    );

    recordButton.addEventListener(
      'click',
      onRecord,
    );

    engineButton?.addEventListener(
      'click',
      onEngine,
    );

    bpmInput?.addEventListener(
      'change',
      onBpmChange,
    );

    loopButton?.addEventListener(
      'click',
      onLoop,
    );

    timeline?.addEventListener(
      'pointerdown',
      onTimelinePointer,
    );

    sync();

    const unsubscribe =
      store.subscribe(
        (state) => {
          sync(state);
        },
      );

    return () => {
      playButton.removeEventListener(
        'click',
        onPlay,
      );

      stopButton.removeEventListener(
        'click',
        onStop,
      );

      recordButton.removeEventListener(
        'click',
        onRecord,
      );

      engineButton?.removeEventListener(
        'click',
        onEngine,
      );

      bpmInput?.removeEventListener(
        'change',
        onBpmChange,
      );

      loopButton?.removeEventListener(
        'click',
        onLoop,
      );

      timeline?.removeEventListener(
        'pointerdown',
        onTimelinePointer,
      );

      unsubscribe();
    };
  }, [
    rootRef,
    togglePlay,
    stop,
    toggleRecord,
    seekTo,
    resumeContext,
    contextState,
  ]);
}
