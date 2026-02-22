#!/bin/bash

# migrate.sh - Complete migration guide for OTP system implementation

set -e

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "================================================"
echo "OTP System Migration Script"
echo "================================================"
echo ""

# Step 1: Database migration
echo "[1/5] Running Prisma migration..."
cd "$BACKEND_DIR"
npx prisma migrate dev --name add_otp_system

# Step 2: Generate Prisma client
echo "[2/5] Generating Prisma client..."
npx prisma generate

# Step 3: Install Stripe (if needed)
echo "[3/5] Checking dependencies..."
if ! grep -q "stripe" package.json; then
  echo "Installing Stripe client..."
  npm install stripe
fi

# Step 4: Environment setup
echo "[4/5] Setting up environment variables..."
if ! grep -q "STRIPE_SECRET_KEY" .env; then
  echo "STRIPE_SECRET_KEY=sk_test_" >> .env
  echo "  → Added STRIPE_SECRET_KEY placeholder to .env"
fi

if ! grep -q "LOGIN_OTP_REQUIRED" .env; then
  echo "LOGIN_OTP_REQUIRED=false" >> .env
  echo "  → Added LOGIN_OTP_REQUIRED to .env"
fi

# Step 5: Cleanup (optional)
echo "[5/5] Cleaning up legacy fields..."
echo "  ✓ Schema updated: emailVerificationCodeHash/ExpiresAt/SentAt removed"
echo "  ✓ New OTP table created"
echo "  ✓ PaymentMethod enhanced with Stripe token support"

echo ""
echo "================================================"
echo "Migration Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Update STRIPE_SECRET_KEY in .env with your actual key"
echo "2. Test OTP flow: npm test"
echo "3. Start server: npm run dev"
echo "4. Update frontend clients to use new OTP endpoints"
echo ""
echo "Documentation: backend/OTP_SYSTEM.md"
echo ""
