import { createAsyncStorage } from '@react-native-async-storage/async-storage';

const storage = createAsyncStorage('tagwatch');
const key = 'tagwatch.state.v1';
export const readState = () => storage.getItem(key);

// Serialize writes and coalesce checkpoints if the disk is slow.
export function createWriter(onResult: (error: boolean) => void) {
  let pending: string | null = null;
  let writing = false;
  let waiters: Array<(success: boolean) => void> = [];
  async function drain() {
    if (writing) {
      return;
    }
    writing = true;
    let success = true;
    while (pending !== null) {
      const value = pending;
      pending = null;
      try {
        await storage.setItem(key, value);
        success = true;
        onResult(false);
      } catch {
        success = false;
        onResult(true);
      }
    }
    writing = false;
    const completed = waiters;
    waiters = [];
    completed.forEach(resolve => resolve(success));
  }
  return (value: string) =>
    new Promise<boolean>(resolve => {
      pending = value;
      waiters.push(resolve);
      drain();
    });
}
