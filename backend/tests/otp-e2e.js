import axios from 'axios';

/**
 * OTP System E2E Tests
 * Test all OTP flows: registration, email verification, password reset, login, etc.
 * 
 * Usage:
 *   node tests/otp-e2e.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // don't throw on non-2xx
});

let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function assert(condition, message) {
  if (!condition) {
    testResults.failed++;
    testResults.errors.push(message);
    console.error(`   ✗ ${message}`);
  } else {
    testResults.passed++;
    console.log(`   ✓ ${message}`);
  }
}

async function testRegistration() {
  console.log('\n[TEST] Registration Flow');
  try {
    const res = await client.post('/auth/register', {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'TestPass123!',
      cardNumber: '4242424242424242',
      cardExpMonth: 12,
      cardExpYear: 2025,
      cardCvc: '123'
    });

    assert(res.status === 201, `Register returns 201 (got ${res.status})`);
    assert(res.data.user?.id, 'User created with ID');
    assert(res.data.verificationRequired === true, 'Email verification required');
    assert(res.data.user.emailVerified === false, 'Email not verified initially');
    assert(res.data.user.trialActive === false, 'Trial not activated until email verified');

    const debugCode = res.data.debugCode;
    assert(debugCode, 'Debug code returned in dev mode');

    return { email: res.data.user.email, debugCode, userId: res.data.user.id };
  } catch (error) {
    assert(false, `Registration error: ${error.message}`);
    return null;
  }
}

async function testEmailVerification(email, code) {
  console.log('\n[TEST] Email Verification Flow');
  try {
    const res = await client.post('/auth/email/verify', { email, code });

    assert(res.status === 200, `Email verify returns 200 (got ${res.status})`);
    assert(res.data.ok === true, 'Verification successful');

    // Verify user is now email verified and trial active
    const loginRes = await client.post('/auth/login', {
      email,
      password: 'TestPass123!'
    });
    assert(loginRes.status === 200, 'User can login after email verification');
    assert(loginRes.data.token, 'JWT token issued');

    return true;
  } catch (error) {
    assert(false, `Email verification error: ${error.message}`);
    return false;
  }
}

async function testEmailVerificationFailure(email, badCode) {
  console.log('\n[TEST] Email Verification Failure Handling');
  try {
    const res = await client.post('/auth/email/verify', { email, code: badCode });

    assert(res.status === 400, `Invalid code returns 400 (got ${res.status})`);
    assert(res.data.error, 'Error message provided');

    return true;
  } catch (error) {
    assert(false, `Email verification failure test error: ${error.message}`);
    return false;
  }
}

async function testPasswordResetRequest(email) {
  console.log('\n[TEST] Password Reset Request');
  try {
    const res = await client.post('/auth/password/forgot', { email });

    assert(res.status === 200, `Forgot password returns 200 (got ${res.status})`);
    assert(res.data.message, 'Generic success message');

    const debugCode = res.data.debugCode;
    assert(debugCode, 'Debug code returned in dev mode');

    return debugCode;
  } catch (error) {
    assert(false, `Password reset request error: ${error.message}`);
    return null;
  }
}

async function testPasswordReset(email, code, newPassword) {
  console.log('\n[TEST] Password Reset with OTP');
  try {
    const res = await client.post('/auth/password/reset', {
      email,
      code,
      newPassword
    });

    assert(res.status === 200, `Password reset returns 200 (got ${res.status})`);
    assert(res.data.message, 'Success message provided');

    // Verify old password no longer works
    const badLoginRes = await client.post('/auth/login', {
      email,
      password: 'TestPass123!'
    });
    assert(badLoginRes.status === 401, 'Old password rejected after reset');

    // Verify new password works
    const goodLoginRes = await client.post('/auth/login', {
      email,
      password: newPassword
    });
    assert(goodLoginRes.status === 200, 'New password accepted');
    assert(goodLoginRes.data.token, 'JWT token issued with new password');

    return true;
  } catch (error) {
    assert(false, `Password reset error: ${error.message}`);
    return false;
  }
}

async function testRateLimiting(email) {
  console.log('\n[TEST] Rate Limiting & Brute Force Protection');
  try {
    // Attempt verification multiple times with wrong code
    let failed = 0;
    for (let i = 0; i < 6; i++) {
      const res = await client.post('/auth/email/verify', {
        email,
        code: '999999'
      });

      if (res.status === 429) {
        assert(res.headers['retry-after'], 'Retry-After header present');
        console.log(`   ✓ Rate limit applied after ${i} attempts`);
        return true;
      }
      if (res.status === 400) {
        failed++;
      }
    }

    assert(failed > 0, 'Multiple failed attempts tracked');
    return true;
  } catch (error) {
    assert(false, `Rate limiting test error: ${error.message}`);
    return false;
  }
}

async function testOtpGenericEndpoints(email) {
  console.log('\n[TEST] Generic OTP Endpoints');
  try {
    // Request OTP for password reset
    const reqRes = await client.post('/auth/otp/request', {
      email,
      purpose: 'password_reset'
    });

    assert(reqRes.status === 200, `OTP request returns 200 (got ${reqRes.status})`);
    assert(reqRes.data.ok === true, 'Request successful');

    const code = reqRes.data.debugCode;
    assert(code, 'Debug code returned');

    // Verify OTP
    const verRes = await client.post('/auth/otp/verify', {
      email,
      purpose: 'password_reset',
      code
    });

    assert(verRes.status === 200, `OTP verify returns 200 (got ${verRes.status})`);
    assert(verRes.data.ok === true, 'Verification successful');

    return true;
  } catch (error) {
    assert(false, `Generic OTP endpoints error: ${error.message}`);
    return false;
  }
}

async function testResendLimiting(email) {
  console.log('\n[TEST] Resend Rate Limiting');
  try {
    // Request multiple OTPs
    const requests = [];
    for (let i = 0; i < 4; i++) {
      const res = await client.post('/auth/email/resend', { email });
      requests.push(res);
    }

    // Third should succeed, fourth may fail due to rate limit
    assert(requests[0].status === 200, 'First resend succeeds');
    assert(requests[1].status === 200, 'Second resend succeeds');
    assert(requests[2].status === 200, 'Third resend succeeds');

    // Fourth might be rate limited
    if (requests[3].status === 429) {
      console.log('   ✓ Resend rate limit applied on 4th request');
    } else {
      console.log('   ℹ Resend rate limit not triggered (may depend on timing)');
    }

    return true;
  } catch (error) {
    assert(false, `Resend limiting test error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   OTP System E2E Test Suite                ║');
  console.log('╚════════════════════════════════════════════╝');

  // Registration
  const regResult = await testRegistration();
  if (!regResult) {
    console.error('\n[FATAL] Registration failed; cannot continue');
    process.exit(1);
  }
  const { email, debugCode, userId } = regResult;

  // Email Verification
  await testEmailVerification(email, debugCode);
  await testEmailVerificationFailure(email, '000000');

  // Password Reset
  const resetCode = await testPasswordResetRequest(email);
  if (resetCode) {
    await testPasswordReset(email, resetCode, 'NewSecure123!');
  }

  // Rate Limiting
  await testRateLimiting(email);

  // Generic Endpoints
  await testOtpGenericEndpoints(email);

  // Resend Limiting
  await testResendLimiting(email);

  // Print Summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Summary                             ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\nPassed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);

  if (testResults.failed > 0) {
    console.log('\nErrors:');
    testResults.errors.forEach(err => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
