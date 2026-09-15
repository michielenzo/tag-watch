export type Stopwatch = { id: string; name: string; elapsedMs: number };
export type State = {
  watches: Stopwatch[];
  runningId: string | null;
  startedAt: number | null;
  nextNumber: number;
  theme: 'dark' | 'light';
};
export type Action =
  | { type: 'toggle'; id: string }
  | { type: 'add' }
  | { type: 'rename'; id: string; name: string }
  | { type: 'reset' | 'delete'; id: string }
  | { type: 'theme' };

export const initialState = (): State => ({
  watches: [{ id: 'watch-1', name: 'Stopwatch 1', elapsedMs: 0 }],
  runningId: null,
  startedAt: null,
  nextNumber: 2,
  theme: 'dark',
});

export function elapsed(watch: Stopwatch, state: State, now: number) {
  return (
    watch.elapsedMs +
    (state.runningId === watch.id && state.startedAt !== null
      ? Math.max(0, now - state.startedAt)
      : 0)
  );
}

export function pause(state: State, now: number): State {
  return {
    ...state,
    watches: state.watches.map(watch => ({
      ...watch,
      elapsedMs: elapsed(watch, state, now),
    })),
    runningId: null,
    startedAt: null,
  };
}

export function update(state: State, action: Action, now: number): State {
  switch (action.type) {
    case 'add': {
      const id = `watch-${state.nextNumber}`;
      const paused = pause(state, now);
      return {
        ...paused,
        watches: [
          ...paused.watches,
          { id, name: `Stopwatch ${state.nextNumber}`, elapsedMs: 0 },
        ],
        runningId: id,
        startedAt: now,
        nextNumber: state.nextNumber + 1,
      };
    }
    case 'toggle':
      if (!state.watches.some(w => w.id === action.id)) {
        return state;
      }
      return {
        ...pause(state, now),
        runningId: state.runningId === action.id ? null : action.id,
        startedAt: state.runningId === action.id ? null : now,
      };
    case 'rename':
      return {
        ...state,
        watches: state.watches.map(w =>
          w.id === action.id
            ? { ...w, name: action.name.trim().slice(0, 80) || w.name }
            : w,
        ),
      };
    case 'reset':
      return {
        ...state,
        watches: state.watches.map(w =>
          w.id === action.id ? { ...w, elapsedMs: 0 } : w,
        ),
        runningId: state.runningId === action.id ? null : state.runningId,
        startedAt: state.runningId === action.id ? null : state.startedAt,
      };
    case 'delete':
      if (state.watches.length === 1) {
        return state;
      }
      return {
        ...state,
        watches: state.watches.filter(w => w.id !== action.id),
        runningId: state.runningId === action.id ? null : state.runningId,
        startedAt: state.runningId === action.id ? null : state.startedAt,
      };
    case 'theme':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
  }
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

export function serialize(state: State, now: number) {
  return JSON.stringify({ version: 1, ...pause(state, now) });
}

export function restore(raw: string | null): State {
  if (raw === null) {
    return initialState();
  }
  const data = JSON.parse(raw);
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.watches) ||
    !data.watches.length ||
    !Number.isSafeInteger(data.nextNumber) ||
    data.nextNumber < 2 ||
    !['dark', 'light'].includes(data.theme)
  ) {
    throw new Error('Invalid saved state');
  }
  const ids = new Set<string>();
  for (const watch of data.watches) {
    if (
      !watch ||
      typeof watch.id !== 'string' ||
      !/^watch-[1-9]\d*$/.test(watch.id) ||
      Number(watch.id.slice(6)) >= data.nextNumber ||
      ids.has(watch.id) ||
      typeof watch.name !== 'string' ||
      !watch.name.trim() ||
      watch.name.length > 80 ||
      !Number.isFinite(watch.elapsedMs) ||
      watch.elapsedMs < 0
    ) {
      throw new Error('Invalid saved stopwatch');
    }
    ids.add(watch.id);
  }
  return {
    watches: data.watches.map((w: Stopwatch) => ({
      id: w.id,
      name: w.name,
      elapsedMs: w.elapsedMs,
    })),
    nextNumber: data.nextNumber,
    theme: data.theme,
    runningId: null,
    startedAt: null,
  };
}
