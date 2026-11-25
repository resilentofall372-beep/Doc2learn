import { useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { errorMessage } from '../services/api';

/**
 * `run(title, fn, setBusy?)` awaits `fn`; if it throws, shows an error notification
 * titled `title` with the server's message. `setBusy` is set true/false around it.
 */
export const useTask = () => {
  const { addNotification } = useApp();
  return useCallback(
    async (title, fn, setBusy) => {
      setBusy?.(true);
      try {
        return await fn();
      } catch (error) {
        addNotification({ type: 'error', title, message: errorMessage(error) });
        return undefined;
      } finally {
        setBusy?.(false);
      }
    },
    [addNotification]
  );
};
