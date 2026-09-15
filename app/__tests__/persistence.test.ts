const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  createAsyncStorage: () => ({
    setItem: (...args: unknown[]) => mockSetItem(...args),
  }),
}));
import { createWriter } from '../src/persistence';

beforeEach(() => mockSetItem.mockReset());

test('slow writes cannot overwrite newer snapshots and pending saves coalesce', async () => {
  let complete!: () => void;
  mockSetItem
    .mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          complete = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const status = jest.fn();
  const write = createWriter(status);
  const first = write('first');
  const second = write('second');
  const last = write('last');
  expect(mockSetItem).toHaveBeenCalledTimes(1);
  complete();
  expect(await Promise.all([first, second, last])).toEqual([true, true, true]);
  expect(mockSetItem.mock.calls.map(call => call[1])).toEqual([
    'first',
    'last',
  ]);
});

test('a failed save reports failure and a later retry can succeed', async () => {
  mockSetItem
    .mockRejectedValueOnce(new Error('disk full'))
    .mockResolvedValue(undefined);
  const status = jest.fn();
  const write = createWriter(status);
  expect(await write('snapshot')).toBe(false);
  expect(status).toHaveBeenLastCalledWith(true);
  expect(await write('snapshot')).toBe(true);
  expect(status).toHaveBeenLastCalledWith(false);
});
