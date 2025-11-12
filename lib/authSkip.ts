let skipAuth = false;

const listeners = new Set<(value: boolean) => void>();

export const getSkipAuth = (): boolean => skipAuth;

export const setSkipAuth = (value: boolean): void => {
  skipAuth = value;
  listeners.forEach((listener) => {
    listener(value);
  });
};

export const subscribeSkipAuth = (listener: (value: boolean) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
