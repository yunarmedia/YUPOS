import { auth } from '../../config/firebase';
import type { LicenseValidationResult } from './types';

const LICENSE_CACHE_KEY = 'yupos_license_cache';

const readCache = (): LicenseValidationResult | null => {
  try {
    const raw = localStorage.getItem(LICENSE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as LicenseValidationResult) : null;
  } catch {
    return null;
  }
};

const writeCache = (result: LicenseValidationResult): void => {
  try {
    localStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(result));
  } catch {
    // Cache is optional; authorization must never depend on it.
  }
};

/**
 * Reads the last server-validated license result from local cache.
 * This is intended for UI bootstrap only and is NOT an authorization boundary.
 */
export const getCachedLicense = (): LicenseValidationResult | null => readCache();

/**
 * Calls the future server-side license endpoint.
 * The endpoint is intentionally not enabled yet so existing YUPOS users are
 * not locked out while the licensing backend is being introduced.
 */
export const validateLicense = async (): Promise<LicenseValidationResult> => {
  const user = auth.currentUser;
  if (!user) {
    return { valid: false, reason: 'missing' };
  }

  // Phase 1 foundation: authentication is available, but the licensing API
  // is not wired into production enforcement yet.
  // Phase 2 will POST a Firebase ID token to /api/license/validate and cache
  // only the server response here.
  return readCache() ?? { valid: false, reason: 'missing' };
};

export const clearLicenseCache = (): void => {
  try {
    localStorage.removeItem(LICENSE_CACHE_KEY);
  } catch {
    // Ignore local cache failures.
  }
};
