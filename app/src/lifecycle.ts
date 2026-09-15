// Mobile operating systems have no reliable force-quit callback.
export function onClose(_saveAndPause: () => Promise<boolean>) {
  return () => {};
}
