// ADDED: network status hook for offline handling (CHECK 6)
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // ADDED: treat null as connected to avoid false offline banners on startup
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  return { isConnected };
}
