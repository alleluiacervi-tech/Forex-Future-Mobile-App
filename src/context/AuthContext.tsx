import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth';
import type { AuthLoginOtpChallenge, AuthLoginResult } from '../services/auth';
import { disconnectMarketSocket, setMarketSocketToken } from '../services/marketSocket';
import { queryClient } from '../services/queryClient'; // ADDED: clear cache on logout

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  trialActive: boolean;
  trialStartedAt?: string;
  baseCurrency?: string;
  riskLevel?: string;
  account?: {
    balance: number;
    equity: number;
    marginUsed: number;
    currency: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthLoginOtpChallenge | void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ verificationRequired?: boolean; verificationUnavailable?: boolean; debugCode?: string; debugExpiresAt?: string }>;
  startTrial: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyLoginOtp: (email: string, code: string) => Promise<void>;
  resendLoginOtp: (email: string) => Promise<{ ok?: boolean; message?: string; debugCode?: string; debugExpiresAt?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ ok?: boolean; alreadyVerified?: boolean }>;
  resendEmailVerification: (email: string) => Promise<{ message?: string; debugCode?: string; debugExpiresAt?: string }>;
  requestPasswordReset: (email: string) => Promise<{ message?: string; debugCode?: string; debugExpiresAt?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isAuthLoginOtpChallenge = (result: AuthLoginResult): result is AuthLoginOtpChallenge =>
  'otpRequired' in result && result.otpRequired === true;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync JWT token to WebSocket manager whenever it changes
  useEffect(() => {
    setMarketSocketToken(token);
  }, [token]);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = await authService.getUser();
        const storedToken = await authService.getToken();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          console.log('[AuthProvider] Auth initialized with stored data');
        } else {
          console.log('[AuthProvider] No stored auth data found');
        }
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result: AuthLoginResult = await authService.login(email, password);

      if (isAuthLoginOtpChallenge(result)) {
        return result;
      }

      setUser(result.user);
      setToken(result.token);
      console.log('[AuthProvider] User logged in:', result.user.email);
    } catch (error) {
      console.error('[AuthProvider] Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyLoginOtp = useCallback(async (email: string, code: string) => {
    try {
      setIsLoading(true);
      const { user: userData, token: authToken } = await authService.verifyLoginOtp(email, code);
      setUser(userData);
      setToken(authToken);
      console.log('[AuthProvider] Login OTP verified:', userData.email);
    } catch (error) {
      console.error('[AuthProvider] Verify login OTP failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIXED: resend operations no longer set global isLoading to avoid blocking verify buttons
  const resendLoginOtp = useCallback(async (email: string) => {
    try {
      return await authService.resendLoginOtp(email);
    } catch (error) {
      console.error('[AuthProvider] Resend login OTP failed:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: userData, verificationRequired, verificationUnavailable, debugCode, debugExpiresAt } =
        await authService.register(name, email, password);
      setUser(userData);
      console.log('[AuthProvider] User registered:', userData.email);
      return { verificationRequired, verificationUnavailable, debugCode, debugExpiresAt };
    } catch (error) {
      console.error('[AuthProvider] Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startTrial = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: userData, token: authToken } = await authService.startTrial(email, password);
      setUser(userData);
      setToken(authToken);
      console.log('[AuthProvider] Trial started:', userData.email);
    } catch (error) {
      console.error('[AuthProvider] Trial start failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIX: logout always clears state, disconnects WS, clears cache — never throws
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
    } catch (error) {
      console.error('[AuthProvider] Logout failed (continuing cleanup):', error);
    } finally {
      setUser(null);
      setToken(null);
      setMarketSocketToken(null);
      disconnectMarketSocket();
      // ADDED: clear React Query cache on logout
      queryClient.clear();
      setIsLoading(false);
      console.log('[AuthProvider] User logged out');
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      setIsLoading(true);
      await authService.changePassword(currentPassword, newPassword);
      console.log('[AuthProvider] Password changed successfully');
    } catch (error) {
      console.error('[AuthProvider] Password change failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    try {
      setIsLoading(true);
      const data = await authService.verifyEmail(email, code);
      setUser((current) =>
        current?.email?.toLowerCase() === email.trim().toLowerCase()
          ? { ...current, emailVerified: true, emailVerifiedAt: new Date().toISOString() }
          : current,
      );
      return data;
    } catch (error) {
      console.error('[AuthProvider] Verify email failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIXED: resend operations no longer set global isLoading to avoid blocking verify buttons
  const resendEmailVerification = useCallback(async (email: string) => {
    try {
      const data = await authService.resendEmailVerification(email);
      return data;
    } catch (error) {
      console.error('[AuthProvider] Resend verification failed:', error);
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      setIsLoading(true);
      const data = await authService.requestPasswordReset(email);
      return data;
    } catch (error) {
      console.error('[AuthProvider] Password reset request failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    try {
      setIsLoading(true);
      const data = await authService.resetPassword(email, code, newPassword);
      return data;
    } catch (error) {
      console.error('[AuthProvider] Password reset failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: userData } = await authService.getMe();
      setUser(userData);
      console.log('[AuthProvider] User data refreshed');
    } catch (error) {
      console.error('[AuthProvider] Failed to refresh user:', error);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    startTrial,
    logout,
    changePassword,
    verifyLoginOtp,
    resendLoginOtp,
    verifyEmail,
    resendEmailVerification,
    requestPasswordReset,
    resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
