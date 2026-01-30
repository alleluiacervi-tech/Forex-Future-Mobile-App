import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '../config/app';

class AuthService {
  constructor() {
    const baseUrl = APP_CONFIG.apiUrl.replace(/\/$/, '');
    this.authBaseUrl = `${baseUrl}/api/auth`;
    this.tokenKey = '@forexapp_token';
    this.userKey = '@forexapp_user';
  }

  async register(name, email, password) {
    try {
      const response = await fetch(`${this.authBaseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      console.log('[AuthService] Registration successful:', data.user.email);
      
      return data;
    } catch (error) {
      console.error('[AuthService] Registration error:', error.message);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.authBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      console.log('[AuthService] Login successful:', data.user.email);
      
      // Store token and user data
      await this.storeAuth(data.user, data.token);
      
      return data;
    } catch (error) {
      console.error('[AuthService] Login error:', error.message);
      throw error;
    }
  }

  async startTrial(email, password) {
    try {
      const response = await fetch(`${this.authBaseUrl}/trial/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Trial activation failed');
      }

      const data = await response.json();
      console.log('[AuthService] Trial started:', data.user.email);
      
      // Store token and user data
      await this.storeAuth(data.user, data.token);
      
      return data;
    } catch (error) {
      console.error('[AuthService] Trial start error:', error.message);
      throw error;
    }
  }

  async changePassword(currentPassword, newPassword) {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Password change failed');
      }

      const data = await response.json();
      console.log('[AuthService] Password changed successfully');
      
      return data;
    } catch (error) {
      console.error('[AuthService] Password change error:', error.message);
      throw error;
    }
  }

  async getMe() {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user');
      }

      const data = await response.json();
      console.log('[AuthService] User data retrieved:', data.user.email);
      
      // Update stored user data
      await this.storeUser(data.user);
      
      return data;
    } catch (error) {
      console.error('[AuthService] Get user error:', error.message);
      throw error;
    }
  }

  async storeAuth(user, token) {
    try {
      await AsyncStorage.setItem(this.tokenKey, token);
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
      console.log('[AuthService] Auth data stored');
    } catch (error) {
      console.error('[AuthService] Failed to store auth data:', error.message);
    }
  }

  async storeUser(user) {
    try {
      await AsyncStorage.setItem(this.userKey, JSON.stringify(user));
    } catch (error) {
      console.error('[AuthService] Failed to store user:', error.message);
    }
  }

  async getToken() {
    try {
      return await AsyncStorage.getItem(this.tokenKey);
    } catch (error) {
      console.error('[AuthService] Failed to get token:', error.message);
      return null;
    }
  }

  async getUser() {
    try {
      const userJson = await AsyncStorage.getItem(this.userKey);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('[AuthService] Failed to get user:', error.message);
      return null;
    }
  }

  async logout() {
    try {
      await AsyncStorage.removeItem(this.tokenKey);
      await AsyncStorage.removeItem(this.userKey);
      console.log('[AuthService] User logged out');
    } catch (error) {
      console.error('[AuthService] Logout error:', error.message);
    }
  }

  async isAuthenticated() {
    const token = await this.getToken();
    return !!token;
  }
}

export default new AuthService();
