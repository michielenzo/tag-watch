import { onClose } from '../src/lifecycle.windows';

let mockCloseHandler: () => Promise<void>;
const mockEnabled = jest.fn();
const mockComplete = jest.fn();
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: (_event: string, listener: () => Promise<void>) => {
      mockCloseHandler = listener;
      return { remove: () => mockRemove() };
    },
  },
  TurboModuleRegistry: {
    getEnforcing: () => ({
      setEnabled: (enabled: boolean) => mockEnabled(enabled),
      completeClose: () => mockComplete(),
    }),
  },
}));

beforeEach(() => jest.clearAllMocks());

test('Windows closes only after a successful save, and unsubscribes on cleanup', async () => {
  let finish!: (saved: boolean) => void;
  const save = jest.fn(
    () =>
      new Promise<boolean>(resolve => {
        finish = resolve;
      }),
  );
  const cleanup = onClose(save);
  const closing = mockCloseHandler();
  await mockCloseHandler();
  expect(save).toHaveBeenCalledTimes(1);
  expect(mockComplete).not.toHaveBeenCalled();
  finish(true);
  await closing;
  expect(mockComplete).toHaveBeenCalledTimes(1);
  cleanup();
  expect(mockEnabled.mock.calls).toEqual([[true], [false]]);
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

test('failed Windows close save keeps the window open and can be retried', async () => {
  const save = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const cleanup = onClose(save);
  await mockCloseHandler();
  expect(mockComplete).not.toHaveBeenCalled();
  await mockCloseHandler();
  expect(mockComplete).toHaveBeenCalledTimes(1);
  cleanup();
});
