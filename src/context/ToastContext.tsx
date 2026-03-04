import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from '../components/common';
import { subscribeToMarketSocket } from '../services/marketSocket';
import { useAuth } from './AuthContext';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastPayload {
  id?: string;
  title: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: ToastPayload) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const severityIsHigh = (severity: unknown) => String(severity || '').toLowerCase().includes('high');

const decimalsForPair = (pair: string) => (pair.includes('JPY') ? 3 : 5);

const formatPrice = (pair: string, value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(decimalsForPair(pair));
};

const toToastFromAlert = (rawAlert: any): ToastPayload | null => {
  const pair = typeof rawAlert?.pair === 'string' ? rawAlert.pair : 'Market';
  const id =
    typeof rawAlert?.id === 'string' && rawAlert.id
      ? rawAlert.id
      : `${pair}-${rawAlert?.triggeredAt || rawAlert?.createdAt || Date.now()}`;

  const from = formatPrice(pair, rawAlert?.fromPrice);
  const to = formatPrice(pair, rawAlert?.toPrice ?? rawAlert?.currentPrice);
  const change = Number(rawAlert?.changePercent);

  let message = 'High-severity market alert detected. Review this pair immediately.';

  if (from && to && Number.isFinite(change)) {
    const sign = change >= 0 ? '+' : '';
    message = `${pair} moved from ${from} to ${to} (${sign}${Math.abs(change).toFixed(2)}%).`;
  } else if (from && to) {
    message = `${pair} moved from ${from} to ${to}.`;
  } else if (typeof rawAlert?.message === 'string' && rawAlert.message.trim()) {
    message = rawAlert.message.trim();
  }

  return {
    id,
    tone: 'warning',
    title: `High Alert: ${pair}`,
    message,
    durationMs: 5000,
  };
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const [queue, setQueue] = useState<ToastPayload[]>([]);
  const [activeToast, setActiveToast] = useState<ToastPayload | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenAlertIdsRef = useRef<Map<string, number>>(new Map());

  const toneColor = useMemo(
    () => ({
      info: theme.colors.info,
      success: theme.colors.success,
      warning: theme.colors.warning,
      error: theme.colors.error,
    }),
    [theme.colors.error, theme.colors.info, theme.colors.success, theme.colors.warning],
  );

  const showToast = useCallback((toast: ToastPayload) => {
    const id = toast.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setQueue((prev) => [...prev, { ...toast, id }]);
  }, []);

  const hideToast = useCallback(() => {
    if (!activeToast) return;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveToast(null);
    });
  }, [activeToast, opacity, translateY]);

  useEffect(() => {
    if (activeToast || queue.length === 0) return;

    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveToast(next);
  }, [activeToast, queue]);

  useEffect(() => {
    if (!activeToast) return;

    opacity.setValue(0);
    translateY.setValue(-16);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const timeoutMs = Number(activeToast.durationMs) > 0 ? Number(activeToast.durationMs) : 4000;
    hideTimerRef.current = setTimeout(() => {
      hideToast();
    }, timeoutMs);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [activeToast, hideToast, opacity, translateY]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[ToastProvider] Skipping WebSocket subscription (not authenticated)');
      return;
    }

    console.log('[ToastProvider] Subscribing to market WebSocket');
    const unsubscribe = subscribeToMarketSocket((event) => {
      if (event.type !== 'marketAlert') return;
      const alert = event.data;
      if (!severityIsHigh((alert as any)?.severity)) return;

      const toast = toToastFromAlert(alert);
      if (!toast?.id) return;

      const now = Date.now();
      const seen = seenAlertIdsRef.current;
      const previousSeenAt = seen.get(toast.id);
      if (previousSeenAt && now - previousSeenAt < 2 * 60 * 1000) {
        return;
      }

      seen.set(toast.id, now);
      if (seen.size > 200) {
        const cutoff = now - 30 * 60 * 1000;
        Array.from(seen.entries()).forEach(([id, ts]) => {
          if (ts < cutoff) {
            seen.delete(id);
          }
        });
      }

      showToast(toast);
    });

    return unsubscribe;
  }, [isAuthenticated, showToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        {activeToast ? (
          <Animated.View
            style={[
              styles.toast,
              {
                borderColor: toneColor[activeToast.tone || 'info'],
                backgroundColor: theme.colors.surface,
                ...(Platform.OS !== 'web' ? { shadowColor: toneColor[activeToast.tone || 'info'] } : {}),
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <Pressable onPress={hideToast} style={styles.pressable}>
              <Text variant="body" style={styles.titleText}>
                {activeToast.title}
              </Text>
              <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.messageText}>
                {activeToast.message}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 12,
    paddingHorizontal: 12,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 14 },
      android: { elevation: 10 },
      web: { boxShadow: '0px 8px 14px rgba(0, 0, 0, 0.2)' },
    }),
  },
  pressable: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleText: {
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    lineHeight: 18,
  },
});
