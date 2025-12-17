import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export const useAppState = (callback: (state: AppStateStatus) => void) => {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      callback(nextAppState);
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [callback]);
};

