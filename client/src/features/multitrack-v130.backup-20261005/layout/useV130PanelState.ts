import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  cloneV130PanelState,
  createDefaultV130PanelState,
  type V130PanelId,
  type V130PanelStateMap,
} from './v130-layout';

export interface V130PanelController {
  state: V130PanelStateMap;
  max: V130PanelId | null;
  toggle: (
    id: V130PanelId,
    collapse?: boolean,
  ) => void;
  collapseAll: () => void;
  expandAll: () => void;
  reset: () => void;
  maximize: (
    id: V130PanelId | null,
  ) => void;
  set3D: (
    id: V130PanelId,
    enabled: boolean,
  ) => void;
  setAll3D: (
    enabled: boolean,
  ) => void;
}

export function useV130PanelState(): V130PanelController {
  const [state, setState] =
    useState<V130PanelStateMap>(
      createDefaultV130PanelState,
    );

  const [max, setMax] =
    useState<V130PanelId | null>(
      null,
    );

  const toggle = useCallback(
    (
      id: V130PanelId,
      collapse?: boolean,
    ) => {
      setState((current) => {
        const next =
          cloneV130PanelState(
            current,
          );

        next[id].c =
          collapse == null
            ? !next[id].c
            : collapse;

        return next;
      });

      setMax((current) =>
        current === id &&
        collapse !== false
          ? null
          : current,
      );
    },
    [],
  );

  const collapseAll =
    useCallback(() => {
      setMax(null);

      setState(() => {
        const next =
          createDefaultV130PanelState();

        for (const id of Object.keys(
          next,
        ) as V130PanelId[]) {
          next[id].c = true;
        }

        return next;
      });
    }, []);

  const expandAll =
    useCallback(() => {
      setMax(null);

      setState((current) => {
        const next =
          cloneV130PanelState(
            current,
          );

        for (const id of Object.keys(
          next,
        ) as V130PanelId[]) {
          next[id].c = false;
        }

        return next;
      });
    }, []);

  const reset =
    useCallback(() => {
      setMax(null);
      setState(
        createDefaultV130PanelState,
      );
    }, []);

  const maximize =
    useCallback(
      (id: V130PanelId | null) => {
        if (id === 'side') return;

        setMax(id);

        if (!id) return;

        setState((current) => {
          const next =
            cloneV130PanelState(
              current,
            );

          next[id].c = false;

          return next;
        });
      },
      [],
    );

  const set3D =
    useCallback(
      (
        id: V130PanelId,
        enabled: boolean,
      ) => {
        setState((current) => {
          const next =
            cloneV130PanelState(
              current,
            );

          next[id].d3 =
            enabled;

          return next;
        });
      },
      [],
    );

  const setAll3D =
    useCallback(
      (enabled: boolean) => {
        setState((current) => {
          const next =
            cloneV130PanelState(
              current,
            );

          for (const id of Object.keys(
            next,
          ) as V130PanelId[]) {
            next[id].d3 =
              enabled;
          }

          return next;
        });
      },
      [],
    );

  return useMemo(
    () => ({
      state,
      max,
      toggle,
      collapseAll,
      expandAll,
      reset,
      maximize,
      set3D,
      setAll3D,
    }),
    [
      state,
      max,
      toggle,
      collapseAll,
      expandAll,
      reset,
      maximize,
      set3D,
      setAll3D,
    ],
  );
}
