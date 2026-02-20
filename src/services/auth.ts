import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app';
import type { User } from '../context/AuthContext';

type AuthRegisterResponse = {
  user: User;
  account?: User['account'];
  trialRequired?: boolean;
  verificationRequired?: boolean;
  verificationUnavailable?: boolean;
  debugCode?: string;
  debugExpiresAt?: string;
};

type AuthLoginResponse = {
  user: User;
  account?: User['account'];
  token: string;
};

type AuthForgotPasswordResponse = {
  message?: string;
  debugToken?: string;
  debugLink?: string;
};

type AuthMessageResponse = {
  message?: string;
};

type VerifyEmailResponse = {
  ok?: boolean;
  alreadyVerified?: boolean;
  message?: string;
};

type ResendVerificationResponse = {
  message?: string;
  debugCode?: string;
  debugExpiresAt?: string;
};

type ErrorResponse = {
  error?: string;
  verificationRequired?: boolean;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const withNetworkHint = (error: unknown, endpoint: string) => {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  const message = error.message.toLowerCase();
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('load failed')
  ) {
    return new Error(
      `Unable to reach auth server at ${endpoint}. Set EXPO_PUBLIC_API_URL to a reachable backend URL and restart Expo.`,
    );
  }

  return error;
};

const pickError = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback;
  const errorValue = (data as ErrorResponse).error;
  return typeof errorValue === 'string' && errorValue ? errorValue : fallback;
};

class AuthApiError extends Error {
  verificationRequired?: boolean;

  constructor(message: string, options: { verificationRequired?: boolean } = {}) {
    super(message);
    this.name = 'AuthApiError';
    this.verificationRequired = options.verificationRequired;
  }
}

const isVerificationRequired = (data: unknown) =>
  Boolean(data && typeof data === 'object' && (data as ErrorResponse).verificationRequired);

class AuthService {
  private authBaseUrl: string;
  private tokenKey: string;
  private userKey: string;

  constructor() {
    const baseUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');
    this.authBaseUrl = `${baseUrl}/api/auth`;
    this.tokenKey = '@forexapp_token';
    this.userKey = '@forexapp_user';
  }

  async register(name: string, email: string, password: string): Promise<AuthRegisterResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthRegisterResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Registration failed'));
      }

      if (!data.user) {
        throw new Error('Registration failed');
      }

      console.log('[AuthService] Registration successful:', data.user.email);

      return data as AuthRegisterResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/register`);
      console.error('[AuthService] Registration error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async verifyEmail(email: string, code: string): Promise<VerifyEmailResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<VerifyEmailResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Email verification failed'));
      }

      return data as VerifyEmailResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/email/verify`);
      console.error('[AuthService] Verify email error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async resendEmailVerification(email: string): Promise<ResendVerificationResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/email/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<ResendVerificationResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Unable to resend verification code'));
      }

      return data as ResendVerificationResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/email/resend`);
      console.error('[AuthService] Resend verification error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async login(email: string, password: string): Promise<AuthLoginResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthLoginResponse> & ErrorResponse;

      if (!response.ok) {
        const message = pickError(data, 'Login failed');
        if (isVerificationRequired(data)) {
          throw new AuthApiError(message, { verificationRequired: true });
        }
        throw new Error(message);
      }

      if (!data.user || !data.token) {
        throw new Error('Login failed');
      }

      console.log('[AuthService] Login successful:', data.user.email);

      // Store token and user data
      await this.storeAuth(data.user, data.token);

      return data as AuthLoginResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/login`);
      console.error('[AuthService] Login error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async startTrial(email: string, password: string): Promise<AuthLoginResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/trial/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthLoginResponse> & ErrorResponse;

      if (!response.ok) {
        const message = pickError(data, 'Trial activation failed');
        if (isVerificationRequired(data)) {
          throw new AuthApiError(message, { verificationRequired: true });
        }
        throw new Error(message);
      }

      if (!data.user || !data.token) {
        throw new Error('Trial activation failed');
      }

      console.log('[AuthService] Trial started:', data.user.email);

      // Store token and user data
      await this.storeAuth(data.user, data.token);

      return data as AuthLoginResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/trial/start`);
      console.error('[AuthService] Trial start error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthMessageResponse> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${this.authBaseUrl}/password/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthMessageResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Password change failed'));
      }

      console.log('[AuthService] Password changed successfully');

      return data as AuthMessageResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/password/change`);
      console.error('[AuthService] Password change error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async requestPasswordReset(email: string): Promise<AuthForgotPasswordResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/password/forgot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthForgotPasswordResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Password reset request failed'));
      }

      return data as AuthForgotPasswordResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/password/forgot`);
      console.error('[AuthService] Password reset request error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthMessageResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<AuthMessageResponse> & ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Password reset failed'));
      }

      return data as AuthMessageResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/password/reset`);
      console.error('[AuthService] Password reset error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async getMe(): Promise<{ user: User; account?: User['account'] }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${this.authBaseUrl}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = (await response.json().catch(() => ({}))) as Partial<{ user: User; account?: User['account'] }> &
        ErrorResponse;

      if (!response.ok) {
        throw new Error(pickError(data, 'Failed to fetch user'));
      }

      if (!data.user) {
        throw new Error('Failed to fetch user');
      }

      console.log('[AuthService] User data retrieved:', data.user.email);

      // Update stored user data
      await this.storeUser(data.user);

      return data as { user: User; account?: User['account'] };
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/me`);
      console.error('[AuthService] Get user error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async storeAuth(user: User, token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.tokenKey, token);
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
      console.log('[AuthService] Auth data stored');
    } catch (error) {
      console.error('[AuthService] Failed to store auth data:', getErrorMessage(error));
    }
  }

  async storeUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
    } catch (error) {
      console.error('[AuthService] Failed to store user:', getErrorMessage(error));
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.tokenKey);
    } catch (error) {
      console.error('[AuthService] Failed to get token:', getErrorMessage(error));
      return null;
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(this.userKey);
      return userJson ? (JSON.parse(userJson) as User) : null;
    } catch (error) {
      console.error('[AuthService] Failed to get user:', getErrorMessage(error));
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.tokenKey);
      await AsyncStorage.removeItem(this.userKey);
      console.log('[AuthService] User logged out');
    } catch (error) {
      console.error('[AuthService] Logout error:', getErrorMessage(error));
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export default new AuthService();
