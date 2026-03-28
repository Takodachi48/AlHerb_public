import { useSyncExternalStore } from 'react';
import { useLoaderService } from '../loader/LoaderContext';

const identity = (value) => value;

export const useLoader = (selector = identity) => {
  const service = useLoaderService();
  const snapshot = useSyncExternalStore(
    service.subscribe,
    service.getState,
    service.getState,
  );
  return selector(snapshot);
};

export const useLoaderActions = () => {
  const service = useLoaderService();
  return {
    start: service.start,
    finish: service.finish,
    addTask: service.addTask,
    completeTask: service.completeTask,
    setProgress: service.setProgress,
    setMessage: service.setMessage,
    setDebug: service.setDebug,
  };
};

