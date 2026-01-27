import { APP_CONFIG } from '../config/app';

class AuthService {
  constructor() {
    this.apiUrl = APP_CONFIG.apiUrl;
    this.tokenKey = '@forexapp_token';
    this.userKey = '@forexapp_user';
  }

  async register(name, email, password) {
    try {
      const response = await fetch(`${this.apiUrl}/auth/register`, {
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
      const response = await fetch(`${this.apiUrl}/auth/login`, {
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
      const response = await fetch(`${this.apiUrl}/auth/trial/start`, {
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

      const response = await fetch(`${this.apiUrl}/auth/password/change`, {
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

      const response = await fetch(`${this.apiUrl}/auth/me`, {
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
      // Store token and user in AsyncStorage for React Native
      if (global.AsyncStorage) {
        await global.AsyncStorage.setItem(this.tokenKey, token);
        await global.AsyncStorage.setItem(this.userKey, JSON.stringify(user));
      } else {
        // Fallback for web/testing
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
      }
      console.log('[AuthService] Auth data stored');
    } catch (error) {
      console.error('[AuthService] Failed to store auth data:', error.message);
    }
  }

  async storeUser(user) {
    try {
      if (global.AsyncStorage) {
        await global.AsyncStorage.setItem(this.userKey, JSON.stringify(user));
      } else {
        localStorage.setItem(this.userKey, JSON.stringify(user));
      }
    } catch (error) {
      console.error('[AuthService] Failed to store user:', error.message);
    }
  }

  async getToken() {
    try {
      if (global.AsyncStorage) {
        return await global.AsyncStorage.getItem(this.tokenKey);
      } else {
        return localStorage.getItem(this.tokenKey);
      }
    } catch (error) {
      console.error('[AuthService] Failed to get token:', error.message);
      return null;
    }
  }

  async getUser() {
    try {
      if (global.AsyncStorage) {
        const userJson = await global.AsyncStorage.getItem(this.userKey);
        return userJson ? JSON.parse(userJson) : null;
      } else {
        const userJson = localStorage.getItem(this.userKey);
        return userJson ? JSON.parse(userJson) : null;
      }
    } catch (error) {
      console.error('[AuthService] Failed to get user:', error.message);
      return null;
    }
  }

  async logout() {
    try {
      if (global.AsyncStorage) {
        await global.AsyncStorage.removeItem(this.tokenKey);
        await global.AsyncStorage.removeItem(this.userKey);
      } else {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
      }
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
