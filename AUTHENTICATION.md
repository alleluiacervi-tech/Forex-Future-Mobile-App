# Authentication & Authorization System

## Overview

This document describes the comprehensive authentication and authorization system for the Forex Trading App, including user registration, login, trial activation, password management, and logging.

## Features

### Backend Authentication (`backend/src/`)

1. **AuthService** (`services/auth.js`)
   - User registration with validation
   - User authentication (login)
   - Free trial activation
   - Password changes
   - Password strength validation
   - JWT token management

2. **Logger** (`utils/logger.js`)
   - Structured logging for all auth operations
   - Log files stored in `backend/logs/`
   - Separate error logs for tracking issues
   - Console output for development

3. **Auth Routes** (`routes/auth.js`)
   - `POST /auth/register` - Register new user
   - `POST /auth/login` - Login user
   - `POST /auth/trial/start` - Activate free trial
   - `POST /auth/password/change` - Change password (requires authentication)
   - `GET /auth/me` - Get current user (requires authentication)

4. **Auth Middleware** (`middleware/auth.js`)
   - JWT token verification
   - User validation
   - Trial status checking
   - Request logging

### Frontend Authentication (`src/`)

1. **AuthService** (`services/auth.ts`)
   - API communication
   - Token management
   - User data persistence
   - Error handling

2. **AuthContext** (`context/AuthContext.tsx`)
   - React Context for auth state
   - Global auth state management
   - Methods for login, register, logout

3. **useAuth Hook** (exported from `context/AuthContext.tsx`)
   - Access auth state in components
   - Convenient API for auth operations

## User Registration Flow

```
User enters email, password, name
          ↓
Frontend validates input
          ↓
POST /auth/register
          ↓
Backend validates password strength
          ↓
Check email uniqueness
          ↓
Hash password with bcrypt
          ↓
Create user in database
          ↓
Create account and watchlist
          ↓
Return user object (without password)
          ↓
Frontend stores user data
          ↓
Display trial activation screen
```

## User Login Flow

```
User enters email and password
          ↓
Frontend validates input
          ↓
POST /auth/login
          ↓
Backend finds user by email
          ↓
Compare password with hash
          ↓
Check trial status
          ↓
Generate JWT token
          ↓
Return user and token
          ↓
Frontend stores token and user data
          ↓
Navigate to main app
```

## Trial Activation Flow

```
New user after registration
          ↓
POST /auth/trial/start
          ↓
Verify email and password
          ↓
Check trial not already active
          ↓
Mark trial as active with timestamp
          ↓
Generate JWT token
          ↓
Return user and token
          ↓
User gains access to app
```

## Password Strength Requirements

Passwords must meet ALL of the following criteria:

- **Minimum 8 characters**
- **At least one uppercase letter** (A-Z)
- **At least one lowercase letter** (a-z)
- **At least one number** (0-9)

Examples:
- ✅ `MyPassword123` - Valid
- ✅ `SecurePass456` - Valid
- ❌ `password` - Missing uppercase and numbers
- ❌ `Password` - Missing number
- ❌ `Pass123` - Too short (7 characters)

## API Endpoints

### POST /auth/register
Register a new user

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com",
    "trialActive": false,
    "account": {
      "balance": 100000,
      "equity": 100000,
      "marginUsed": 0,
      "currency": "USD"
    }
  },
  "trialRequired": true
}
```

**Errors:**
- `400` - Validation error (weak password, invalid email)
- `409` - Email already registered

### POST /auth/login
Login user

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "user": { ... },
  "account": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `401` - Invalid credentials
- `403` - Trial not activated

### POST /auth/trial/start
Activate free trial

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "user": { ... },
  "account": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `401` - Invalid credentials
- `400` - Trial already active

### POST /auth/password/change
Change password (requires authentication)

**Request Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response:**
```json
{
  "message": "Password updated successfully."
}
```

**Errors:**
- `401` - Incorrect current password
- `400` - New password doesn't meet requirements

### GET /auth/me
Get current user (requires authentication)

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": { ... },
  "account": { ... }
}
```

**Errors:**
- `401` - Invalid or missing token
- `403` - Trial expired
- `404` - User not found

## Frontend Usage

### Setup

1. **Wrap your app with AuthProvider:**

```tsx
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}
```

2. **Use useAuth hook in components:**

```tsx
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { login, isLoading, user } = useAuth();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'Password123');
      // Navigation handled in navigation logic
    } catch (error) {
      Alert.alert('Login Error', error.message);
    }
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <Button onPress={handleLogin} title="Login" disabled={isLoading} />
  );
}
```

### Available Methods

```tsx
const {
  user,                    // Current user object or null
  token,                   // JWT token or null
  isLoading,              // Loading state
  isAuthenticated,        // Boolean - true if logged in
  
  login,                  // Async login method
  register,               // Async register method
  startTrial,            // Async trial activation
  logout,                // Async logout
  changePassword,        // Async password change
  refreshUser,           // Refresh user data from server
} = useAuth();
```

### Example: Complete Auth Flow

```tsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuthFlowExample() {
  const { register, startTrial, login, isLoading } = useAuth();
  const [stage, setStage] = useState('register'); // 'register', 'trial', 'login'
  const [credentials, setCredentials] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Step 1: Register
  const handleRegister = async () => {
    try {
      await register(credentials.name, credentials.email, credentials.password);
      setStage('trial');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Step 2: Activate trial
  const handleStartTrial = async () => {
    try {
      await startTrial(credentials.email, credentials.password);
      // User logged in with trial active
      setStage('success');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Or login existing user
  const handleLogin = async () => {
    try {
      await login(credentials.email, credentials.password);
      // User logged in
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    // Render appropriate screen based on 'stage'
    // Call appropriate handler based on user action
  );
}
```

## Logging

### Backend Logs

Logs are stored in `backend/logs/` directory:

- `app.log` - General application logs
- `error.log` - Error and warning logs

### Log Format

```json
{
  "timestamp": "2026-01-27T10:30:45.123Z",
  "level": "INFO",
  "logger": "AuthService",
  "message": "User registered successfully",
  "userId": "user_123",
  "email": "user@example.com"
}
```

### Log Levels

- **INFO** - Successful operations
- **WARN** - Security-relevant events, validation failures
- **ERROR** - Exceptions and errors
- **DEBUG** - Detailed information (development only)

### Important Log Events

- User registration attempts
- Failed registration validations
- Login attempts
- Failed login attempts
- Password changes
- Token issuance
- Token verification failures
- Trial activations
- Authorization failures

## Security Features

1. **Password Hashing**
   - bcryptjs with salt rounds of 10
   - Never stored in plain text
   - Never returned in API responses

2. **JWT Tokens**
   - Signed with secret key
   - Configurable expiration time
   - Verified on every protected request

3. **Input Validation**
   - Email format validation
   - Password strength validation
   - Name length validation
   - Zod schema validation on all endpoints

4. **Rate Limiting** (Recommended)
   - Add rate limiting middleware for auth endpoints
   - Prevent brute force attacks

5. **HTTPS** (Production)
   - All auth tokens transmitted over HTTPS
   - Tokens stored securely on client

6. **Trial Management**
   - Trial status checked on every auth request
   - Expired trial prevents access
   - Timestamp tracking for trial duration

## Configuration

### Backend (`backend/src/config.js`)

```javascript
{
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
  jwtExpiresIn: '7d'
}
```

### Frontend (`src/config/app.ts`)

```typescript
{
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
  // API base URL for auth requests
}
```

## Development Guide

### Running the System

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
npm start
```

### Testing Auth Endpoints

Use a tool like Postman or cURL to test endpoints:

```bash
# Register
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Get user (replace TOKEN with actual JWT)
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### "Invalid credentials"
- Check email and password are correct
- Verify user exists in database
- Check password hash is stored properly

### "Trial not activated"
- User must activate trial before accessing app
- Trigger trial activation endpoint

### "Token verification failed"
- Token may be expired (check expiresIn config)
- Token may be invalid or tampered with
- Check JWT_SECRET matches between signing and verification

### "Password does not meet requirements"
- Must be 8+ characters
- Must have uppercase, lowercase, and number
- Suggest password to user that meets all requirements

### Logs not being written
- Check `backend/logs/` directory exists
- Verify file permissions allow writing
- Check Node.js process has access to logs directory

## Next Steps

1. **Add Rate Limiting** - Prevent brute force attacks
2. **Add Email Verification** - Confirm email ownership
3. **Add Password Reset** - Allow users to reset forgotten passwords
4. **Add 2FA** - Two-factor authentication for extra security
5. **Add OAuth** - Google, Apple sign-in integration
6. **Database Backup** - Regular backup of user data
7. **Security Audit** - Regular security reviews

## Support

For issues or questions:
1. Check logs in `backend/logs/`
2. Enable debug mode to see detailed output
3. Review this documentation
4. Test endpoints with Postman 
clear
