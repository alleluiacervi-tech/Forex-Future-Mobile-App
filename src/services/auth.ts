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

export type AuthLoginOtpChallenge = {
  otpRequired: true;
  email: string;
  debugCode?: string;
  debugExpiresAt?: string;
};

export type AuthLoginResult = AuthLoginResponse | AuthLoginOtpChallenge;

type AuthForgotPasswordResponse = {
  message?: string;
  debugCode?: string;
  debugExpiresAt?: string;
};

type AuthMessageResponse = {
  message?: string;
};

type OtpVerifyResponse = {
  ok?: boolean;
  token?: string;
  message?: string;
};

type OtpRequestResponse = {
  ok?: boolean;
  message?: string;
  debugCode?: string;
  debugExpiresAt?: string;
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
  error?: string | { code?: string; message?: string }; // FIX: error can be string or object from apiResponse envelope
  code?: string; // ADDED: error code for frontend logic
  verificationRequired?: boolean;
  trialRequired?: boolean;
  otpRequired?: boolean;
  debugCode?: string;
  debugExpiresAt?: string;
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
    const hint = `Unable to reach auth server at ${endpoint}. Set EXPO_PUBLIC_API_URL to a reachable backend URL and restart Expo.`;
    console.error(`[AuthService] NETWORK ERROR: ${hint} (original: ${error.message})`);
    return new Error(hint);
  }

  return error;
};

// FIX: pickError now handles both {error: "string"} and {error: {message: "string"}} formats
// from the apiResponse middleware envelope
const pickError = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback;
  const raw = data as Record<string, unknown>;

  // Handle apiResponse envelope: {success: false, error: {code, message}}
  if (raw.success === false && raw.error && typeof raw.error === 'object') {
    const nested = raw.error as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message) return nested.message;
  }

  // Handle direct {error: "string"} format
  const errorValue = (data as ErrorResponse).error;
  if (typeof errorValue === 'string' && errorValue) return errorValue;

  // Handle {message: "string"} format
  if (typeof raw.message === 'string' && raw.message) return raw.message;

  return fallback;
};

// FIX: Helper to extract error code from apiResponse envelope
const pickErrorCode = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;
  // Handle {success: false, error: {code: "AUTH_..."}}
  if (raw.success === false && raw.error && typeof raw.error === 'object') {
    const nested = raw.error as Record<string, unknown>;
    if (typeof nested.code === 'string') return nested.code;
  }
  // Handle direct {code: "AUTH_..."}
  if (typeof raw.code === 'string') return raw.code;
  return undefined;
};

// FIX: unwrapEnvelope extracts data from {success: true, data: {...}} envelope
const unwrapEnvelope = <T>(raw: unknown): T => {
  if (!raw || typeof raw !== 'object') return raw as T;
  const obj = raw as Record<string, unknown>;
  // If this is a success envelope, return the data portion
  if (obj.success === true && Object.prototype.hasOwnProperty.call(obj, 'data') && obj.data && typeof obj.data === 'object') {
    return obj.data as T;
  }
  return raw as T;
};

class AuthApiError extends Error {
  verificationRequired?: boolean;
  trialRequired?: boolean;
  code?: string; // ADDED: error code for frontend logic

  constructor(message: string, options: { verificationRequired?: boolean; trialRequired?: boolean; code?: string } = {}) {
    super(message);
    this.name = 'AuthApiError';
    this.verificationRequired = options.verificationRequired;
    this.trialRequired = options.trialRequired;
    this.code = options.code;
  }
}

const isVerificationRequired = (data: unknown) =>
  Boolean(data && typeof data === 'object' && (data as ErrorResponse).verificationRequired);

const isTrialRequired = (data: unknown) =>
  Boolean(data && typeof data === 'object' && (data as ErrorResponse).trialRequired);

const isOtpRequired = (data: unknown) =>
  Boolean(data && typeof data === 'object' && (data as ErrorResponse).otpRequired);

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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error code and message from apiResponse envelope
        const message = pickError(rawData, 'Registration failed');
        const errorCode = pickErrorCode(rawData);
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope {success: true, data: {...}}
      const data = unwrapEnvelope<Partial<AuthRegisterResponse> & ErrorResponse>(rawData);

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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error code from apiResponse envelope
        const message = pickError(rawData, 'Email verification failed');
        const errorCode = pickErrorCode(rawData);
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<VerifyEmailResponse>(rawData);
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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error from apiResponse envelope
        throw new Error(pickError(rawData, 'Unable to resend verification code'));
      }

      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<ResendVerificationResponse>(rawData);
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/email/resend`);
      console.error('[AuthService] Resend verification error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async login(email: string, password: string): Promise<AuthLoginResult> {
    try {
      const response = await fetch(`${this.authBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        const message = pickError(rawData, 'Login failed');
        // FIX: extract error code from apiResponse envelope for frontend error handling
        const errorCode = pickErrorCode(rawData);
        // FIX: check verificationRequired/trialRequired in both envelope and direct format
        const unwrapped = unwrapEnvelope<ErrorResponse>(rawData);
        if (isVerificationRequired(rawData) || isVerificationRequired(unwrapped)) {
          throw new AuthApiError(message, { verificationRequired: true, code: errorCode });
        }
        if (isTrialRequired(rawData) || isTrialRequired(unwrapped)) {
          throw new AuthApiError(message, { trialRequired: true, code: errorCode });
        }
        if (isOtpRequired(rawData) || isOtpRequired(unwrapped)) {
          return {
            otpRequired: true,
            email,
            debugCode: unwrapped.debugCode,
            debugExpiresAt: unwrapped.debugExpiresAt,
          };
        }
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope {success: true, data: {user, token}}
      const data = unwrapEnvelope<Partial<AuthLoginResponse> & Partial<AuthLoginOtpChallenge> & ErrorResponse>(rawData);

      if (data.otpRequired) {
        return {
          otpRequired: true,
          email,
          debugCode: data.debugCode,
          debugExpiresAt: data.debugExpiresAt,
        };
      }

      if (!data.user || !data.token) {
        throw new Error('Login failed');
      }

      console.log('[AuthService] Login successful:', data.user.email);

      // FIX: store refresh token alongside access token
      await this.storeAuth(data.user, data.token, (data as any).refreshToken);

      return data as AuthLoginResponse;
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/login`);
      console.error('[AuthService] Login error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async verifyLoginOtp(email: string, code: string): Promise<AuthLoginResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, purpose: 'login', code }),
      });

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error code from apiResponse envelope
        const message = pickError(rawData, 'OTP verification failed');
        const errorCode = pickErrorCode(rawData);
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope
      const data = unwrapEnvelope<Partial<OtpVerifyResponse> & ErrorResponse>(rawData);

      const token = typeof data.token === 'string' ? data.token : '';
      if (!token) {
        throw new Error('OTP verification failed');
      }

      // FIX: store refresh token from OTP verify response
      const refreshToken = typeof data.token === 'string' ? (data as any).refreshToken : undefined;
      const me = await this.fetchMeWithToken(token);
      await this.storeAuth(me.user, token, refreshToken);

      return {
        user: me.user,
        account: me.account,
        token,
      };
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/otp/verify`);
      console.error('[AuthService] Verify login OTP error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async resendLoginOtp(email: string): Promise<OtpRequestResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/otp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, purpose: 'login' }),
      });

      const rawData = (await response.json().catch(() => ({})));
      if (!response.ok) {
        // FIX: extract error from apiResponse envelope
        throw new Error(pickError(rawData, 'Unable to resend login code'));
      }
      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<OtpRequestResponse>(rawData);
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/otp/request`);
      console.error('[AuthService] Resend login OTP error:', getErrorMessage(enrichedError));
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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        const message = pickError(rawData, 'Trial activation failed');
        // FIX: extract error code and check flags from apiResponse envelope
        const errorCode = pickErrorCode(rawData);
        const unwrapped = unwrapEnvelope<ErrorResponse>(rawData);
        if (isVerificationRequired(rawData) || isVerificationRequired(unwrapped)) {
          throw new AuthApiError(message, { verificationRequired: true, code: errorCode });
        }
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope
      const data = unwrapEnvelope<Partial<AuthLoginResponse> & ErrorResponse>(rawData);

      if (!data.user || !data.token) {
        throw new Error('Trial activation failed');
      }

      console.log('[AuthService] Trial started:', data.user.email);

      // FIX: store refresh token alongside access token
      await this.storeAuth(data.user, data.token, (data as any).refreshToken);

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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error from apiResponse envelope
        throw new Error(pickError(rawData, 'Password change failed'));
      }

      console.log('[AuthService] Password changed successfully');

      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<AuthMessageResponse>(rawData);
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

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error from apiResponse envelope
        throw new Error(pickError(rawData, 'Password reset request failed'));
      }

      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<AuthForgotPasswordResponse>(rawData);
    } catch (error) {
      const enrichedError = withNetworkHint(error, `${this.authBaseUrl}/password/forgot`);
      console.error('[AuthService] Password reset request error:', getErrorMessage(enrichedError));
      throw enrichedError;
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<AuthMessageResponse> {
    try {
      const response = await fetch(`${this.authBaseUrl}/password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const rawData = (await response.json().catch(() => ({})));

      if (!response.ok) {
        // FIX: extract error code from apiResponse envelope
        const message = pickError(rawData, 'Password reset failed');
        const errorCode = pickErrorCode(rawData);
        throw new AuthApiError(message, { code: errorCode });
      }

      // FIX: unwrap apiResponse envelope
      return unwrapEnvelope<AuthMessageResponse>(rawData);
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

      const data = await this.fetchMeWithToken(token);

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

  private async fetchMeWithToken(token: string): Promise<{ user: User; account?: User['account'] }> {
    const response = await fetch(`${this.authBaseUrl}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const rawData = (await response.json().catch(() => ({})));

    if (!response.ok) {
      // FIX: extract error from apiResponse envelope
      throw new Error(pickError(rawData, 'Failed to fetch user'));
    }

    // FIX: unwrap apiResponse envelope
    const data = unwrapEnvelope<Partial<{ user: User; account?: User['account'] }> & ErrorResponse>(rawData);

    if (!data.user) {
      throw new Error('Failed to fetch user');
    }

    return data as { user: User; account?: User['account'] };
  }

  // FIX: accept optional refreshToken and store it alongside access token
  async storeAuth(user: User, token: string, refreshToken?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.tokenKey, token);
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
      if (refreshToken) {
        await AsyncStorage.setItem('@forexapp_refresh_token', refreshToken);
      }
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
      // FIX: call backend logout to invalidate refresh token (fire-and-forget)
      const token = await this.getToken();
      if (token) {
        fetch(`${this.authBaseUrl}/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }).catch(() => {});
      }
      // FIX: remove all auth keys including refresh token
      await AsyncStorage.multiRemove([this.tokenKey, this.userKey, '@forexapp_refresh_token']);
      console.log('[AuthService] User logged out');
    } catch (error) {
      console.error('[AuthService] Logout error:', getErrorMessage(error));
      // FIX: always clear storage even on error
      await AsyncStorage.multiRemove([this.tokenKey, this.userKey, '@forexapp_refresh_token']).catch(() => {});
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export default new AuthService();
