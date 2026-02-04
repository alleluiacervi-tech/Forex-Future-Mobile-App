import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth';

export interface User {
  id: string;
  name: string;
  email: string;
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
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  startTrial: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ message?: string; debugToken?: string; debugLink?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const { user: userData, token: authToken } = await authService.login(email, password);
      setUser(userData);
      setToken(authToken);
      console.log('[AuthProvider] User logged in:', userData.email);
    } catch (error) {
      console.error('[AuthProvider] Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: userData } = await authService.register(name, email, password);
      setUser(userData);
      console.log('[AuthProvider] User registered:', userData.email);
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

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setToken(null);
      console.log('[AuthProvider] User logged out');
    } catch (error) {
      console.error('[AuthProvider] Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
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

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      setIsLoading(true);
      const data = await authService.resetPassword(token, newPassword);
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
