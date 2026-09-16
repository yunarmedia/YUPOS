import { auth } from '../config/firebase';
import { getDeviceId } from './deviceService';
import type { LicenseValidationResult } from './types';
import { APP_VERSION } from '../appVersion';

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

export const getCachedLicense = (): LicenseValidationResult | null => readCache();

const resolveFunctionUrl = (): string => {
  const projectId = 'yuposcashier';
  return `https://asia-southeast1-${projectId}.cloudfunctions.net/validateLicense`;
};

/**
 * Performs a server-side license validation using the current Firebase ID token.
 * The cached result is only a UX/bootstrap fallback and is never sufficient for
 * Firestore authorization, which remains enforced by Firebase Security Rules.
 */
export const validateLicense = async (): Promise<LicenseValidationResult> => {
  const user = auth.currentUser;
  if (!user) {
    return { valid: false, reason: 'missing' };
  }

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(resolveFunctionUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        appVersion: APP_VERSION,
      }),
    });

    const result = (await response.json()) as LicenseValidationResult;
    if (!response.ok && !result.reason) {
      return { valid: false, reason: 'invalid' };
    }

    writeCache(result);
    return result;
  } catch (error) {
    console.warn('YUPOS license validation request failed:', error);
    return readCache() ?? { valid: false, reason: 'invalid' };
  }
};

export const clearLicenseCache = (): void => {
  try {
    localStorage.removeItem(LICENSE_CACHE_KEY);
  } catch {
    // Ignore local cache failures.
  }
};
