import {
  elapsed,
  formatTime,
  initialState,
  restore,
  serialize,
  update,
} from '../src/stopwatches';

test('adding and switching transfers the single running slot without losing elapsed time', () => {
  let state = update(initialState(), { type: 'toggle', id: 'watch-1' }, 0);
  state = update(state, { type: 'add' }, 1250);
  expect(state.runningId).toBe('watch-2');
  expect(state.watches[0].elapsedMs).toBe(1250);
  state = update(state, { type: 'toggle', id: 'watch-1' }, 3750);
  expect(state.watches[1].elapsedMs).toBe(2500);
  expect(elapsed(state.watches[0], state, 4500)).toBe(2000);
  state = update(state, { type: 'toggle', id: 'watch-1' }, 4500);
  expect(state.runningId).toBeNull();
  expect(elapsed(state.watches[0], state, 99000)).toBe(2000);
});

test('elapsed time catches up after a long interval without UI ticks', () => {
  const state = update(initialState(), { type: 'toggle', id: 'watch-1' }, 1000);
  expect(elapsed(state.watches[0], state, 3601000)).toBe(3600000);
});

test('a checkpoint restores paused and never includes time while closed', () => {
  let state = update(initialState(), { type: 'toggle', id: 'watch-1' }, 100);
  state = update(
    state,
    { type: 'rename', id: 'watch-1', name: '  Design  ' },
    200,
  );
  state = update(state, { type: 'theme' }, 300);
  const restored = restore(serialize(state, 2100));
  expect(restored.theme).toBe('light');
  expect(restored.watches[0].name).toBe('Design');
  expect(restored.runningId).toBeNull();
  expect(elapsed(restored.watches[0], restored, 86400000)).toBe(2000);
});

test('last stopwatch cannot be deleted but can be reset', () => {
  let state = update(initialState(), { type: 'toggle', id: 'watch-1' }, 0);
  expect(update(state, { type: 'delete', id: 'watch-1' }, 1000)).toBe(state);
  state = update(state, { type: 'reset', id: 'watch-1' }, 3000);
  expect(state.runningId).toBeNull();
  expect(state.watches[0].elapsedMs).toBe(0);
});

test('deleting or resetting another watch does not interrupt the running one', () => {
  const state = update(initialState(), { type: 'add' }, 100);
  for (const type of ['delete', 'reset'] as const) {
    const next = update(state, { type, id: 'watch-1' }, 500);
    expect(next.runningId).toBe('watch-2');
    expect(next.startedAt).toBe(100);
  }
});

test('deleting a running watch pauses and sequential names are not reused', () => {
  let state = update(initialState(), { type: 'add' }, 0);
  state = update(state, { type: 'delete', id: 'watch-2' }, 1000);
  expect(state.runningId).toBeNull();
  state = restore(serialize(state, 2000));
  state = update(state, { type: 'add' }, 3000);
  expect(state.watches[1].name).toBe('Stopwatch 3');
});

test('empty names are ignored and invalid target IDs cannot start a timer', () => {
  const state = initialState();
  expect(
    update(state, { type: 'rename', id: 'watch-1', name: '  ' }, 0).watches[0]
      .name,
  ).toBe('Stopwatch 1');
  expect(update(state, { type: 'toggle', id: 'missing' }, 0)).toBe(state);
});

test('invalid saved data fails instead of silently overwriting timers', () => {
  expect(restore(null)).toEqual(initialState());
  for (const raw of [
    'null',
    '{}',
    'bad json',
    JSON.stringify({ version: 2 }),
    JSON.stringify({ ...initialState(), version: 1, watches: [] }),
    JSON.stringify({ ...initialState(), version: 1, nextNumber: 1 }),
  ]) {
    expect(() => restore(raw)).toThrow();
  }
});

test('format includes hours, minutes and seconds, with no 24-hour wrap', () => {
  expect(formatTime(999)).toBe('00:00:00');
  expect(formatTime(3661000)).toBe('01:01:01');
  expect(formatTime(360000000)).toBe('100:00:00');
});
