import {
  elapsed,
  formatTime,
  initialState,
  isTimeDraft,
  parseTime,
  restore,
  serialize,
  update,
} from '../src/stopwatches';

test('exact time only accepts complete hh:mm:ss durations', () => {
  expect(parseTime('01:23:45')).toBe(5025000);
  expect(parseTime('00:00:00')).toBe(0);
  for (const value of [
    '1h',
    '+5m',
    '1:00:00',
    '00:60:00',
    '00:00:60',
    '12:34',
    ' 12:34:56',
    '100:00:00',
  ]) {
    expect(parseTime(value)).toBeNull();
  }
  for (const value of [
    '',
    '0',
    '01',
    '01:',
    '01:2',
    '01:23',
    '01:23:',
    '01:23:4',
    '01:23:45',
  ]) {
    expect(isTimeDraft(value)).toBe(true);
  }
  for (const value of [
    'a',
    '0:',
    '01:6',
    '01:23:6',
    '123',
    '01::23',
    '-01:00:00',
  ]) {
    expect(isTimeDraft(value)).toBe(false);
  }
});

test('adjustments use current running time and restart the time anchor without pausing', () => {
  let state = update(initialState(), { type: 'toggle', id: 'watch-1' }, 1000);
  state = update(
    state,
    { type: 'adjustTime', id: 'watch-1', milliseconds: 60000 },
    3500,
  );
  expect(state.runningId).toBe('watch-1');
  expect(elapsed(state.watches[0], state, 4000)).toBe(63000);
  state = update(
    state,
    { type: 'setTime', id: 'watch-1', milliseconds: 10000 },
    5000,
  );
  expect(elapsed(state.watches[0], state, 6000)).toBe(11000);
  state = update(
    state,
    { type: 'adjustTime', id: 'watch-1', milliseconds: -1800000 },
    6000,
  );
  expect(elapsed(state.watches[0], state, 6000)).toBe(0);
  expect(elapsed(state.watches[0], state, 7000)).toBe(1000);
  expect(state.runningId).toBe('watch-1');
  expect(restore(serialize(state, 7000)).watches[0].elapsedMs).toBe(1000);
});

test('editing a paused timer preserves another running timer and clamps subtraction to zero', () => {
  let state = update(initialState(), { type: 'add' }, 100);
  state = update(
    state,
    { type: 'setTime', id: 'watch-1', milliseconds: 300000 },
    500,
  );
  state = update(
    state,
    { type: 'adjustTime', id: 'watch-1', milliseconds: -1800000 },
    1000,
  );
  expect(state.watches[0].elapsedMs).toBe(0);
  expect(state.runningId).toBe('watch-2');
  expect(state.startedAt).toBe(100);
  expect(elapsed(state.watches[1], state, 1000)).toBe(900);
});

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
