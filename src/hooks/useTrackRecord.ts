import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../services/api';

export interface TrackRecord {
  total: number;
  wins: number;
  losses: number;
  expired: number;
  winRate: number;
  avgPnlPips: number;
}

const EMPTY: TrackRecord = { total: 0, wins: 0, losses: 0, expired: 0, winRate: 0, avgPnlPips: 0 };

export function useTrackRecord(pollMs = 60_000) {
  const [stats, setStats] = useState<TrackRecord>(EMPTY);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const data = await apiGet<TrackRecord>('/api/market/track-record');
      if (data && typeof data.total === 'number') {
        setStats(data);
      }
    } catch {
      // silently fail — stats are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollMs);
    return () => clearInterval(id);
  }, [fetch, pollMs]);

  return { stats, loading, refetch: fetch };
}
