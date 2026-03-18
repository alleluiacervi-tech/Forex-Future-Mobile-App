// ADDED: subscription status hook for trial/premium checks (CHECK 3 + CHECK 10)
import { useState, useEffect, useCallback } from 'react';
import { apiAuthGet } from '../services/api';
import { useAuth } from '../context/AuthContext';

export type SubscriptionInfo = {
  plan: string | null;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
};

export type SubscriptionState = {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  /** true when user has active/trial access */
  hasAccess: boolean;
  /** true when trial is active and ending within 3 days */
  trialEndingSoon: boolean;
  /** days remaining in trial, null if not on trial */
  trialDaysLeft: number | null;
  /** true when subscription is cancelled but still in period */
  cancelledButActive: boolean;
  refetch: () => Promise<void>;
};

export function useSubscriptionStatus(): SubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refetch = useCallback(async () => {
    try {
      const data = await apiAuthGet<{ subscription: SubscriptionInfo | null }>('/api/paypal/subscription');
      setSubscription(data?.subscription || null);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const now = new Date();
  const status = subscription?.status || null;

  // Admin users always have full access — single-point bypass
  const hasAccess =
    Boolean(user?.isAdmin) ||
    status === 'active' ||
    (status === 'trial' && !!subscription?.trialEnd && new Date(subscription.trialEnd) > now) ||
    (status === 'cancelled' && !!subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > now) ||
    (status === 'past_due' && !!subscription?.gracePeriodEnd && new Date(subscription.gracePeriodEnd) > now);

  let trialDaysLeft: number | null = null;
  if (status === 'trial' && subscription?.trialEnd) {
    const diff = new Date(subscription.trialEnd).getTime() - now.getTime();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }

  const trialEndingSoon = trialDaysLeft !== null && trialDaysLeft <= 3;
  const cancelledButActive =
    status === 'cancelled' && !!subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > now;

  return {
    subscription,
    loading,
    hasAccess,
    trialEndingSoon,
    trialDaysLeft,
    cancelledButActive,
    refetch,
  };
}
