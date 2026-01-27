# Authentication System - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AUTH SCREENS                                 │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  • Welcome Screen (Login)                                │   │
│  │  • Subscription Screen (Register)                        │   │
│  │  • Trial Activation Screen                              │   │
│  │  • Settings Screen (Change Password)                    │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                               │
│  ┌────────────────▼─────────────────────────────────────────┐   │
│  │              REACT CONTEXT                               │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  AuthContext                                             │   │
│  │  ├─ user (User | null)                                  │   │
│  │  ├─ token (string | null)                               │   │
│  │  ├─ isLoading (boolean)                                 │   │
│  │  ├─ isAuthenticated (boolean)                           │   │
│  │  └─ Methods:                                            │   │
│  │     ├─ login(email, password)                           │   │
│  │     ├─ register(name, email, password)                  │   │
│  │     ├─ startTrial(email, password)                      │   │
│  │     ├─ logout()                                         │   │
│  │     ├─ changePassword(curr, new)                        │   │
│  │     └─ refreshUser()                                    │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                               │
│  ┌────────────────▼─────────────────────────────────────────┐   │
│  │              AUTH SERVICE                                │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  • API client for auth endpoints                         │   │
│  │  • Token storage/retrieval                              │   │
│  │  • User data persistence                                │   │
│  │  • Error handling                                        │   │
│  │  • Logging                                               │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │ HTTP Requests                                 │
│                   │ Authorization: Bearer <token>                │
└───────────────────┼──────────────────────────────────────────────┘
                    │
        ┌───────────▼──────────────┐
        │   NETWORK / INTERNET     │
        └───────────┬──────────────┘
                    │
        ┌───────────▼──────────────────────────────────────────┐
        │            EXPRESS BACKEND                            │
        ├──────────────────────────────────────────────────────┤
        │                                                        │
        │  ┌─────────────────────────────────────────────────┐ │
        │  │           AUTH ROUTES                           │ │
        │  ├─────────────────────────────────────────────────┤ │
        │  │  POST   /auth/register                          │ │
        │  │  POST   /auth/login                             │ │
        │  │  POST   /auth/trial/start                       │ │
        │  │  GET    /auth/me         (protected)            │ │
        │  │  POST   /auth/password/change (protected)       │ │
        │  └────────────────┬────────────────────────────────┘ │
        │                   │                                    │
        │  ┌────────────────▼────────────────────────────────┐ │
        │  │        AUTH MIDDLEWARE                          │ │
        │  ├─────────────────────────────────────────────────┤ │
        │  │  • Extract token from header                    │ │
        │  │  • Verify JWT signature                         │ │
        │  │  • Validate token expiration                    │ │
        │  │  • Check trial status                           │ │
        │  │  • Attach user to request                       │ │
        │  │  • Logging                                      │ │
        │  └────────────────┬────────────────────────────────┘ │
        │                   │                                    │
        │  ┌────────────────▼────────────────────────────────┐ │
        │  │         AUTH SERVICE                            │ │
        │  ├─────────────────────────────────────────────────┤ │
        │  │  Registration:                                  │ │
        │  │  ├─ Validate email format                       │ │
        │  │  ├─ Validate password strength                  │ │
        │  │  ├─ Check email uniqueness                      │ │
        │  │  └─ Hash password & create user                 │ │
        │  │                                                  │ │
        │  │  Authentication:                                │ │
        │  │  ├─ Find user by email                          │ │
        │  │  ├─ Compare password hash                       │ │
        │  │  ├─ Verify trial status                         │ │
        │  │  └─ Generate JWT token                          │ │
        │  │                                                  │ │
        │  │  Trial Management:                              │ │
        │  │  ├─ Activate trial                              │ │
        │  │  ├─ Check expiration                            │ │
        │  │  └─ Update timestamp                            │ │
        │  │                                                  │ │
        │  │  Password Management:                           │ │
        │  │  ├─ Validate current password                   │ │
        │  │  ├─ Validate new password strength              │ │
        │  │  └─ Hash & update password                      │ │
        │  └────────────────┬────────────────────────────────┘ │
        │                   │                                    │
        │  ┌────────────────▼────────────────────────────────┐ │
        │  │           LOGGER SYSTEM                         │ │
        │  ├─────────────────────────────────────────────────┤ │
        │  │  • Console output (development)                 │ │
        │  │  • File logging (app.log)                       │ │
        │  │  • Error logging (error.log)                    │ │
        │  │  • JSON structured logs                         │ │
        │  │  • Security event tracking                      │ │
        │  └────────────────┬────────────────────────────────┘ │
        │                   │                                    │
        │  ┌────────────────▼────────────────────────────────┐ │
        │  │          DATABASE (PostgreSQL)                  │ │
        │  ├─────────────────────────────────────────────────┤ │
        │  │  User Table:                                    │ │
        │  │  ├─ id (UUID)                                   │ │
        │  │  ├─ name (string)                               │ │
        │  │  ├─ email (string, unique)                      │ │
        │  │  ├─ passwordHash (string, bcrypt)               │ │
        │  │  ├─ trialActive (boolean)                       │ │
        │  │  ├─ trialStartedAt (timestamp)                  │ │
        │  │  ├─ createdAt (timestamp)                       │ │
        │  │  └─ updatedAt (timestamp)                       │ │
        │  │                                                  │ │
        │  │  Account Table:                                 │ │
        │  │  ├─ balance (decimal)                           │ │
        │  │  ├─ equity (decimal)                            │ │
        │  │  ├─ marginUsed (decimal)                        │ │
        │  │  └─ currency (string)                           │ │
        │  │                                                  │ │
        │  │  Watchlist Table:                               │ │
        │  │  └─ pairs (array of strings)                    │ │
        │  └──────────────────────────────────────────────────┘ │
        │                                                        │
        └──────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Registration Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ REGISTRATION FLOW                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User Input (name, email, password)                             │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │ Frontend Validation                  │                       │
│  │ ├─ Email format                      │                       │
│  │ └─ Password minimum length           │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ POST /auth/register                  │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ Backend Validation                   │                       │
│  │ ├─ Email format & uniqueness         │                       │
│  │ ├─ Password strength (8+, UC, LC, #) │                       │
│  │ └─ Name length (2+)                  │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│       ┌─────▼──────┐                                            │
│       │ Valid?      │                                            │
│       └─┬─────────┬─┘                                            │
│        YES       NO                                             │
│         │         │                                              │
│         ▼         └──► Return Error (400/409)                   │
│  ┌────────────────────────────────┐                            │
│  │ Hash Password (bcryptjs)       │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Create User in Database        │                            │
│  │ ├─ Store hashed password       │                            │
│  │ ├─ Create account (balance)    │                            │
│  │ └─ Create watchlist            │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Return User (without password) │                            │
│  │ + trialRequired: true          │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Log: User Registered (201)     │                            │
│  └────────────────────────────────┘                            │
│                                                                   │
│  Next: Trial Activation Screen                                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Login Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ LOGIN FLOW                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User Input (email, password)                                   │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │ Frontend Validation                  │                       │
│  │ ├─ Email not empty                   │                       │
│  │ └─ Password not empty                │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ POST /auth/login                     │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ Find User by Email                   │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│       ┌─────▼──────┐                                            │
│       │ Found?      │                                            │
│       └─┬─────────┬─┘                                            │
│        YES       NO                                             │
│         │         │                                              │
│         ▼         └──► Return Error (401)                       │
│  ┌────────────────────────────────┐                            │
│  │ Compare Passwords (bcryptjs)   │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│       ┌─────▼──────┐                                            │
│       │ Match?      │                                            │
│       └─┬─────────┬─┘                                            │
│        YES       NO                                             │
│         │         │                                              │
│         ▼         └──► Return Error (401)                       │
│  ┌────────────────────────────────┐                            │
│  │ Check Trial Status             │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│       ┌─────▼──────┐                                            │
│       │ Trial OK?   │                                            │
│       └─┬─────────┬─┘                                            │
│        YES       NO                                             │
│         │         │                                              │
│         ▼         └──► Return Error (403)                       │
│  ┌────────────────────────────────┐                            │
│  │ Generate JWT Token             │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Return User + Token            │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Log: User Logged In (200)      │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────┐                            │
│  │ Store Token & User Locally     │                            │
│  └──────────┬─────────────────────┘                            │
│             │                                                   │
│             ▼                                                   │
│  Navigate to Main App                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Protected Route Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ PROTECTED ROUTE FLOW (GET /auth/me)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Component renders                                              │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │ useAuth Hook                         │                       │
│  │ const { user, refreshUser } = ...    │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ GET /auth/me                         │                       │
│  │ + Authorization: Bearer <token>      │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ Auth Middleware                      │                       │
│  │ 1. Extract token from header         │                       │
│  │ 2. Verify JWT signature              │                       │
│  │ 3. Check expiration                  │                       │
│  │ 4. Fetch user from database          │                       │
│  │ 5. Check trial status                │                       │
│  │ 6. Attach user to request            │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│       ┌─────▼─────┐                                             │
│       │ Valid?     │                                             │
│       └─┬─────────┬─┘                                            │
│        YES       NO                                             │
│         │         │                                              │
│         ▼         └──► Return Error (401/403)                   │
│  ┌──────────────────────────────────────┐                       │
│  │ Route Handler                        │                       │
│  │ req.user available                   │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ Return User Data + Account           │                       │
│  └──────────┬───────────────────────────┘                       │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ Update Local State                   │                       │
│  │ & Render Component                   │                       │
│  └──────────────────────────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Password Strength Validation

```
Password: MyPassword123

✓ Length Check
  └─ 12 characters >= 8 required ✅

✓ Uppercase Check
  └─ M, P ✅

✓ Lowercase Check
  └─ y, p, a, s, s, w, o, r, d ✅

✓ Number Check
  └─ 1, 2, 3 ✅

Result: ✅ VALID
```

## Security Layers

```
        ┌─────────────────────────────────────────┐
        │  CLIENT SIDE                            │
        │  ├─ Input validation                    │
        │  ├─ Password strength check             │
        │  └─ Secure token storage                │
        └─────────────┬───────────────────────────┘
                      │ HTTPS
        ┌─────────────▼───────────────────────────┐
        │  TRANSPORT                              │
        │  └─ Encrypted connection (HTTPS)        │
        └─────────────┬───────────────────────────┘
                      │
        ┌─────────────▼───────────────────────────┐
        │  SERVER SIDE                            │
        │  ├─ Input validation (Zod)              │
        │  ├─ Email format check                  │
        │  ├─ Password strength check             │
        │  ├─ Unique email enforcement            │
        │  ├─ Password hashing (bcryptjs)         │
        │  ├─ JWT signing & verification          │
        │  ├─ Authorization checks                │
        │  ├─ Trial status validation             │
        │  └─ Comprehensive logging               │
        └─────────────┬───────────────────────────┘
                      │
        ┌─────────────▼───────────────────────────┐
        │  DATABASE                               │
        │  ├─ Hashed passwords (never plain text) │
        │  ├─ User validation & constraints       │
        │  ├─ Secure data storage                 │
        │  └─ Audit logging                       │
        └─────────────────────────────────────────┘
```

---

**System Status:** ✅ Complete and Ready for Integration
