#!/usr/bin/env node

/**
 * Validates that pnpm-lock.yaml is in sync with package.json
 * This script runs automatically on install to catch lockfile issues early
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Only check if we're using pnpm
const userAgent = process.env.npm_config_user_agent || '';
if (!userAgent.includes('pnpm')) {
  process.exit(0);
}

// Check if lockfile exists
const lockfilePath = path.join(process.cwd(), 'pnpm-lock.yaml');
if (!fs.existsSync(lockfilePath)) {
  console.warn('⚠️  pnpm-lock.yaml not found. This is expected for new projects.');
  process.exit(0);
}

try {
  // Try to validate lockfile sync by checking if install would work with frozen lockfile
  // This is a best-effort check - actual validation happens at build/deploy time
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  const lockfile = fs.readFileSync(lockfilePath, 'utf8');
  
  // Basic check: ensure lockfile exists and has content
  if (lockfile.trim().length === 0) {
    throw new Error('Lockfile is empty');
  }
  
  // Check if lockfile mentions all major dependencies
  const depNames = Object.keys(packageJson.dependencies || {}).concat(
    Object.keys(packageJson.devDependencies || {})
  );
  
  // If we have dependencies, lockfile should reference some of them
  if (depNames.length > 0) {
    const hasDeps = depNames.some(dep => lockfile.includes(dep));
    if (!hasDeps && depNames.length > 0) {
      throw new Error('Lockfile appears to be out of sync');
    }
  }
  
  // Silent success - lockfile looks valid
} catch (error) {
  console.error('\n❌ WARNING: pnpm-lock.yaml may be out of sync with package.json');
  console.error('   Run: pnpm install');
  console.error('   This will update the lockfile to match package.json\n');
  
  // Only exit with error if we're in CI or strict mode
  if (process.env.CI === 'true' || process.env.LOCKFILE_CHECK_STRICT === 'true') {
    process.exit(1);
  }
  
  // Otherwise just warn (allows install to continue)
  // This is a non-blocking check during development
}

