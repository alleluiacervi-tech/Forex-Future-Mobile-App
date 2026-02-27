# OTP Authentication System Documentation

## Overview

This document describes the new 6-digit numeric One-Time Password (OTP) system that replaces all token-based email verification links. The system is modular, secure against brute force attacks, and fully integrated across all authentication flows.

## Architecture & Components

### 1. OtpService (`backend/src/services/otp.js`)

Core OTP management service with the following responsibilities:

- **Generate OTP**: Creates a cryptographically random 6-digit code, hashes it with SHA-256, stores in database with metadata
- **Verify OTP**: Checks hash against submitted code; on failure increments attempts counter with progressive delay; on success marks OTP as used
- **Cleanup**: Periodically invalidates expired OTPs to keep database clean

**Key Features:**
- OTP Expiry: 5 minutes (configurable via environment)
- Max Attempts: 5 (configurable)
- Resend Limit: 3 per 15 minutes per user (configurable)
- Progressive Delay: On failed attempts, delays response by `300ms * attemptNumber`
- Hashing: SHA-256 (never stores plain OTP)

**Methods:**
```javascript
// Generate OTP for a purpose
const { code, expiresAt } = await otpService.generateOtp(userId, purpose, { ip, deviceInfo });

// Verify OTP code
await otpService.verifyOtp(userId, purpose, submittedCode, { ip, deviceInfo });
// throws on error; marks as used on success

// Cleanup expired records
await otpService.cleanupExpiredOtps();
```

### 2. PaymentService (`backend/src/services/payment.js`)

Handles payment card tokenization via Stripe (or other providers).

**Key Features:**
- Never stores full card number, CVV, or sensitive data
- Tokenizes card via Stripe API before storing reference in database
- Falls back to mock tokens in development (when Stripe not configured)
- Stores only `token`, `brand`, `last4`, `expMonth`, `expYear` in PaymentMethod

**Methods:**
```javascript
// Tokenize a card (do not send CVV to frontend after)
const token = await paymentService.tokenizeCard({
  cardNumber: '4242424242424242',
  cardExpMonth: 12,
  cardExpYear: 2025,
  cardCvc: '123',     // client should never send real CVV to backend
  name: 'John Doe',
  billingPostalCode: '10001'
});
// returns: { id: 'card_xxx', card: { brand, last4, exp_month, exp_year, name, address_zip } }
```

### 3. AuthService (Updated)

Enhanced with the following OTP-related methods:

- `requestEmailVerification(email)` - generates OTP and sends to user
- `verifyEmailCode(email, code, { ip })` - verifies OTP and marks email verified; auto-activates trial
- `requestPasswordReset(email, { ip })` - generates password reset OTP
- `resetPasswordWithOtp(email, code, newPassword, { ip })` - verifies OTP and resets password
- `sendPasswordResetEmail()` - sends OTP-based password reset email
- `sendVerificationEmail()` - sends verification email with OTP
- `authenticateUser()` - optionally requires login OTP if `LOGIN_OTP_REQUIRED=true`
- `getUserByEmail(email)` - helper to fetch user by email

### 4. Database Schema (Prisma)

#### OTP Table

```prisma
model Otp {
  id         String   @id @default(uuid())
  user       User     @relation(fields: [userId], references: [id])
  userId     String
  purpose    String   // "email_verification", "password_reset", "login", "email_change", "payment_update", "account_deletion"
  otpHash    String
  expiresAt  DateTime
  attempts   Int      @default(0)
  used       Boolean  @default(false)
  ip         String?
  deviceInfo String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId, purpose])
  @@index([expiresAt])
}
```

#### Updated User Table

- Removed legacy fields: `emailVerificationCodeHash`, `emailVerificationExpiresAt`, `emailVerificationSentAt`
- Added: `otps: Otp[]` relation
- Trial activation now deferred until email OTP verification

#### PaymentMethod Table

```prisma
model PaymentMethod {
  id                String   @id @default(uuid())
  user              User     @relation(fields: [userId], references: [id])
  userId            String
  provider          String   @default("card")
  brand             String?
  last4             String
  expMonth          Int
  expYear           Int
  holderName        String?
  billingPostalCode String?
  isDefault         Boolean  @default(false)
  token             String?  @unique        // Stripe token, never raw card
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
}
```

## Registration Flow

### Step 1: User Submits Registration

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "cardNumber": "4242424242424242",
  "cardExpMonth": 12,
  "cardExpYear": 2025,
  "cardCvc": "123",
  "billingPostalCode": "10001"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "emailVerified": false,
    "trialActive": false,
    "createdAt": "2026-02-22T..."
  },
  "verificationRequired": true,
  "debugCode": "123456",           // dev only
  "account": { ... }
}
```

**Backend Actions:**
1. Validate email, password, name
2. Check uniqueness (email not already registered)
3. Hash password with bcryptjs
4. Tokenize card via Stripe → store PaymentMethod record
5. Create user with account & watchlist
6. Generate email verification OTP
7. Send OTP via email
8. Return user with `verificationRequired: true`
9. **Trial NOT yet activated** (awaits OTP verification)

### Step 2: User Verifies Email with OTP

**Endpoint:** `POST /api/auth/email/verify`

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Backend Actions:**
1. Fetch user by email
2. Verify OTP via otpService (checks hash, expiry, attempts)
3. Mark OTP as used
4. Set `emailVerified = true`, `emailVerifiedAt = now()`
5. Set `trialActive = true`, `trialStartedAt = now()`
6. Return success

**Rate Limit:**
- Max 6 verification attempts per IP+email within 60 seconds (configurable)
- Progressive delay on failures

### Step 3: User Logs In

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (if `LOGIN_OTP_REQUIRED=false`, default):**
```json
{
  "user": { ... },
  "account": { ... },
  "token": "eyJhbGc..."
}
```

**Response (if `LOGIN_OTP_REQUIRED=true`):**
```json
{
  "otpRequired": true,
  "debugCode": "654321"   // dev only
}
```

**Backend Actions:**
1. Validate credentials
2. If email not verified, throw error
3. If `LOGIN_OTP_REQUIRED`, generate login OTP, send email, return `otpRequired: true`
4. Otherwise, issue JWT token and return

## Password Reset Flow

### Step 1: Request Password Reset

**Endpoint:** `POST /api/auth/password/forgot`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account exists for that email, you'll receive password reset instructions shortly.",
  "debugCode": "789456"   // dev only
}
```

**Backend Actions:**
1. Lookup user by email (generic response even if not found)
2. Generate password_reset OTP
3. Send OTP via email (custom password reset template)
4. Enforce rate limit: 1 request per minute per IP+email

### Step 2: Reset Password with OTP

**Endpoint:** `POST /api/auth/password/reset`

**Request:**
```json
{
  "email": "user@example.com",
  "code": "789456",
  "newPassword": "NewSecure123!"
}
```

**Response:**
```json
{
  "message": "Password reset successfully. Please log in with your new password."
}
```

**Backend Actions:**
1. Lookup user by email
2. Verify OTP via otpService
3. Validate password strength
4. Hash new password
5. Update user `passwordHash`
6. Mark OTP as used

## Additional OTP Flows

### Email Change (Sensitive Action)

**Endpoint:** `POST /api/auth/email-change` (new; requires auth)

**Request:**
```json
{
  "newEmail": "newemail@example.com"
}
```

**Backend Actions:**
1. Authenticate request
2. Generate OTP for purpose `"email_change"`
3. Send OTP to **new email** address
4. Return `oddsRequired: true, purpose: "email_change"`

**Verification Endpoint:** `POST /api/auth/email-change/verify`

**Request:**
```json
{
  "newEmail": "newemail@example.com",
  "code": "456789"
}
```

**Backend Actions:**
1. Verify OTP for purpose `"email_change"`
2. Update user email
3. Mark new email verified

### Payment Update (Sensitive Action)

**Endpoint:** `POST /api/auth/payment/update` (new; requires auth)

**Request:**
```json
{
  "cardNumber": "4242424242424242",
  "cardExpMonth": 12,
  "cardExpYear": 2025,
  "cardCvc": "123"
}
```

**Backend Actions:**
1. Generate OTP for purpose `"payment_update"`
2. Send OTP to user email
3. Return `otpRequired: true`

**Verification:** `POST /api/otp/verify` with `purpose: "payment_update"`

### Account Deletion (Sensitive Action)

**Endpoint:** `POST /api/auth/delete` (new; requires auth)

**Request:**
```json
{
  "password": "SecurePass123!"
}
```

**Backend Actions:**
1. Verify current password
2. Generate OTP for purpose `"account_deletion"`
3. Send OTP to email with warning
4. Return `otpRequired: true`

**Verification:** `POST /api/otp/verify` with `purpose: "account_deletion"`

## Generic OTP Endpoints

For flexibility, two generic endpoints support any OTP purpose:

### Request OTP

**Endpoint:** `POST /api/auth/otp/request`

**Request:**
```json
{
  "email": "user@example.com",
  "purpose": "password_reset"  // or any purpose
}
```

**Response:**
```json
{
  "ok": true,
  "debugCode": "123456"   // dev only
}
```

### Verify OTP

**Endpoint:** `POST /api/auth/otp/verify`

**Request:**
```json
{
  "email": "user@example.com",
  "purpose": "password_reset",
  "code": "123456"
}
```

**Response (login purpose):**
```json
{
  "ok": true,
  "token": "eyJhbGc..."
}
```

**Response (email_verification purpose):**
```json
{
  "ok": true
}
```

## Environment Variables

### OTP Configuration

```bash
# Optional: OTP expiry in minutes (default: 5)
OTP_EXPIRES_MIN=5

# Optional: max verification attempts (default: 5)
OTP_MAX_ATTEMPTS=5

# Optional: resend window in minutes (default: 15)
OTP_RESEND_WINDOW_MIN=15

# Optional: max resends per window (default: 3)
OTP_RESEND_LIMIT=3

# Optional: progressive delay multiplier in ms (default: 300)
OTP_ATTEMPT_BASE_DELAY_MS=300

# Email verification throttle (in-memory rate limiting)
EMAIL_VERIFICATION_THROTTLE_MS=60000        # window
EMAIL_VERIFICATION_THROTTLE_MAX_ATTEMPTS=6  # max attempts

# Optional: require OTP after password on login
LOGIN_OTP_REQUIRED=false

# Payment integration
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_... for dev

# Email branding
EMAIL_BRAND_NAME=Forex Future
```

## Security Considerations

### Brute Force Protection

1. **OTP Hashing**: Stored as SHA-256 hashes; plain code never persisted
2. **Attempt Limiting**: Max 5 incorrect attempts per OTP; after limit, OTP invalidated
3. **Progressive Delay**: Response delayed by 300ms × attemptNumber on failures
4. **Rate Limiting**: Max 3 OTP requests per 15 minutes per user
5. **Resend Limiting**: Only 3 OTPs can be active per 15 minutes per user

### HTTPS & SSL

- All OTP endpoints must be served over HTTPS in production
- Email links should never contain OTP; only plain text code + instructions
- Client must not log or retain OTP after submission

### Logging & Auditing

- All OTP requests logged with user ID, purpose, IP, and device info
- Failed attempts logged for auditing
- OTP cleanup runs periodically to remove expired records

### Database

- OTP records indexed on (userId, purpose) and expiresAt for efficient queries
- Used OTP records kept for 30+ days for audit trail (optional cleanup retention)
- Prisma migration ensures schema compatibility

## Troubleshooting

### OTP Expired

**Error:** "OTP expired. Please request a new code."

**Solution:** User requests new OTP via `/api/auth/otp/request` with same purpose.

### Too Many Attempts

**Error:** "Maximum verification attempts exceeded. Please request a new code."

**Solution:** Rate limiter displays Retry‐After header; user must wait before requesting new OTP.

### Email Not Received

**Solution:** Check email configuration in `.env`; dev mode allows returning `debugCode`.

### Stripe Card Tokenization Failed

**Error:** "Payment information is invalid."

**Cause:** Invalid card details or Stripe API misconfiguration.

**Solution:** Verify STRIPE_SECRET_KEY is set; ensure card details match Stripe format.

## Testing

### Manual Testing (Development)

1. **Register:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "password": "TestPass123!",
       "cardNumber": "4242424242424242",
       "cardExpMonth": 12,
       "cardExpYear": 2025,
       "cardCvc": "123"
     }'
   ```

2. **Check logs for debug code:**
   ```bash
   grep "debugCode" logs/error.log
   ```

3. **Verify Email:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/email/verify \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "code": "123456"}'
   ```

4. **Request Password Reset:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/password/forgot \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

### Automated Testing

Create a test suite in `backend/tests/otp.test.js`:

```javascript
import otpService from '../src/services/otp.js';
import prisma from '../src/db/prisma.js';

describe('OTP Service', () => {
  test('generates and verifies valid OTP', async () => {
    const userId = 'test-user-id';
    const { code } = await otpService.generateOtp(userId, 'email_verification');
    
    await otpService.verifyOtp(userId, 'email_verification', code);
    // success
  });

  test('rejects expired OTP', async () => {
    // set expiresAt to past, attempt verify
  });

  test('enforces max attempts', async () => {
    // submit failed code 5+ times
  });
});
```

## Migration from Legacy Token System

For existing users with token-based verification:

1. **Create Migration Script:**
   ```javascript
   // invalidate all old emailVerificationCode records
   await prisma.user.updateMany({
     data: { emailVerificationCodeHash: null, emailVerificationExpiresAt: null }
   });
   ```

2. **Force Re-verification:**
   - Users with `emailVerified: false` must re-verify via new OTP flow
   - Send bulk OTP generation email with `/api/auth/email/resend`

3. **Verify No Breakage:**
   - Legacy endpoints (`/api/auth/email/verify` with token) no longer work
   - All clients must update to OTP-based verification

## Summary

The OTP system provides:

✅ **Secure:** 6-digit cryptographically random codes, SHA-256 hashing, no plain text storage
✅ **Rate Limited:** 3 requests/15min per user, 5 max attempts, progressive delays
✅ **Modular:** Separate OtpService, PaymentService, generic endpoints
✅ **Comprehensive:** Supports registration, email changes, password resets, login, payments, account deletion
✅ **Clean Database:** Auto-cleanup of expired records every 15 minutes
✅ **Auditable:** Logging of all OTP requests with IP, device info, purposes
✅ **Production Ready:** HTTPS enforcement, proper error handling, fallback in development

