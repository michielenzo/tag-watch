import {
  DeviceEventEmitter,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';

interface Lifecycle extends TurboModule {
  setEnabled(enabled: boolean): void;
  completeClose(): void;
}

export function onClose(saveAndPause: () => Promise<boolean>) {
  const native =
    TurboModuleRegistry.getEnforcing<Lifecycle>('TagWatchLifecycle');
  let closing = false;
  const listener = DeviceEventEmitter.addListener(
    'tagwatchClosing',
    async () => {
      if (closing) {
        return;
      }
      closing = true;
      try {
        if (await saveAndPause()) {
          native.completeClose();
        }
      } finally {
        closing = false;
      }
    },
  );
  native.setEnabled(true);
  return () => {
    native.setEnabled(false);
    listener.remove();
  };
}
