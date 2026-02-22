import prisma from '../db/prisma.js';
import Logger from '../utils/logger.js';

const logger = new Logger('OtpCleanup');

/**
 * Script to cleanup expired, used, and stale OTP records.
 * Run manually or as a cron job.
 *
 * Usage:
 *   node prisma/cleanup-otp.js
 */

async function cleanupOtp() {
  try {
    const now = new Date();

    // Delete expired OTPs that are already marked as used
    const deletedExpired = await prisma.oTp.deleteMany({
      where: {
        AND: [
          { expiresAt: { lt: now } },
          { used: true }
        ]
      }
    });

    logger.info('Deleted expired used OTPs', { count: deletedExpired.count });

    // Mark as used (but don't delete) all expired but unused OTPs
    // This ensures they can't be verified later
    const markedExpired = await prisma.oTp.updateMany({
      where: {
        AND: [
          { expiresAt: { lt: now } },
          { used: false }
        ]
      },
      data: { used: true }
    });

    logger.info('Marked expired unused OTPs as used', { count: markedExpired.count });

    // Optional: Delete very old used OTPs (older than 90 days) to save space
    const thirtyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedOld = await prisma.oTp.deleteMany({
      where: {
        AND: [
          { createdAt: { lt: thirtyDaysAgo } },
          { used: true }
        ]
      }
    });

    logger.info('Deleted old used OTPs (>90 days)', { count: deletedOld.count });

    console.log('OTP cleanup complete.');
    console.log(`  - Deleted expired used: ${deletedExpired.count}`);
    console.log(`  - Marked expired unused: ${markedExpired.count}`);
    console.log(`  - Deleted old records (>90d): ${deletedOld.count}`);
  } catch (error) {
    logger.error('OTP cleanup failed', { error: error.message });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOtp();
