import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const resetToLanding = () => {
  if (!navigationRef.isReady()) {
    return false;
  }

  navigationRef.resetRoot({
    index: 0,
    routes: [{ name: 'Landing' }],
  });

  return true;
};
