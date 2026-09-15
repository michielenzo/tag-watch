import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  Action,
  initialState,
  pause,
  restore,
  serialize,
  update,
} from './stopwatches';
import { createWriter, readState } from './persistence';
import { onClose } from './lifecycle';

declare const performance: { now(): number };
export const clock = () => performance.now();

export function useStopwatches() {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const alive = useRef(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [now, setNow] = useState(clock);
  const writer = useRef<ReturnType<typeof createWriter> | null>(null);
  if (!writer.current) {
    writer.current = createWriter(error => {
      if (alive.current) {
        setSaveError(error);
      }
    });
  }
  const save = useCallback(() => {
    return loaded.current
      ? writer.current!(serialize(current.current, clock()))
      : Promise.resolve(true);
  }, []);
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const restored = restore(await readState());
      if (!alive.current) {
        return;
      }
      current.current = restored;
      setState(restored);
      loaded.current = true;
      setReady(true);
    } catch {
      if (alive.current) {
        setLoadError(true);
      }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    load();
    const interval = setInterval(() => {
      if (current.current.runningId) {
        setNow(clock());
      }
    }, 200);
    const checkpoint = setInterval(() => {
      if (current.current.runningId) {
        save();
      }
    }, 1000);
    const listener = AppState.addEventListener('change', () => {
      setNow(clock());
      save();
    });
    const removeCloseListener = onClose(async () => {
      const time = clock();
      current.current = pause(current.current, time);
      setState(current.current);
      setNow(time);
      setReady(false);
      const saved = await save();
      if (!saved) {
        setReady(true);
      }
      return saved;
    });
    return () => {
      alive.current = false;
      clearInterval(interval);
      clearInterval(checkpoint);
      listener.remove();
      removeCloseListener();
      save();
    };
  }, [load, save]);
  const dispatch = useCallback(
    (action: Action) => {
      if (!loaded.current) {
        return;
      }
      const time = clock();
      current.current = update(current.current, action, time);
      setState(current.current);
      setNow(time);
      save();
    },
    [save],
  );
  return {
    state,
    now,
    ready,
    loadError,
    saveError,
    dispatch,
    retryLoad: load,
    retrySave: save,
  };
}
