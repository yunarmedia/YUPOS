import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

const allowedOrigins = new Set([
  'https://yunarmedia.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
]);

const defaultFeatures = {
  pos: true,
  inventory: false,
  reports: false,
  printer: false,
  customer: false,
  excelExport: false,
};

const json = (res: Parameters<typeof onRequest>[0] extends never ? never : any, status: number, body: unknown) => {
  res.status(status).json(body);
};

const isExpired = (expiresAt: unknown): boolean => {
  if (!expiresAt) return false;

  if (expiresAt instanceof Timestamp) {
    return expiresAt.toMillis() <= Date.now();
  }

  if (typeof expiresAt === 'string' || typeof expiresAt === 'number') {
    const millis = new Date(expiresAt).getTime();
    return Number.isFinite(millis) && millis <= Date.now();
  }

  return false;
};

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();

  const date = new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export const validateLicense = onRequest(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 15,
    memory: '256MiB',
    cors: true,
  },
  async (req, res) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { valid: false, reason: 'invalid' });
      return;
    }

    try {
      const authorization = req.get('Authorization') || '';
      if (!authorization.startsWith('Bearer ')) {
        json(res, 401, { valid: false, reason: 'missing' });
        return;
      }

      const idToken = authorization.slice('Bearer '.length).trim();
      if (!idToken) {
        json(res, 401, { valid: false, reason: 'missing' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(idToken, true);
      const merchantId = decoded.uid;
      const requestedDeviceId = String(req.body?.deviceId || '').trim();
      const appVersion = String(req.body?.appVersion || '').trim();

      if (!requestedDeviceId || requestedDeviceId.length > 128) {
        json(res, 400, { valid: false, reason: 'invalid' });
        return;
      }

      const merchantRef = db.doc(`merchants/${merchantId}`);
      const merchantSnap = await merchantRef.get();

      if (!merchantSnap.exists) {
        json(res, 404, { valid: false, reason: 'missing' });
        return;
      }

      const merchant = merchantSnap.data() || {};
      const licenseId = String(merchant.licenseId || '').trim();

      if (!licenseId) {
        json(res, 404, { valid: false, reason: 'missing' });
        return;
      }

      const licenseRef = db.doc(`licenses/${licenseId}`);
      const licenseSnap = await licenseRef.get();

      if (!licenseSnap.exists) {
        json(res, 404, { valid: false, reason: 'missing' });
        return;
      }

      const license = licenseSnap.data() || {};
      const status = String(license.status || merchant.licenseStatus || '').toLowerCase();

      if (status === 'suspended') {
        json(res, 403, { valid: false, reason: 'suspended' });
        return;
      }

      if (status === 'revoked') {
        json(res, 403, { valid: false, reason: 'revoked' });
        return;
      }

      if (status !== 'active') {
        json(res, 403, { valid: false, reason: 'invalid' });
        return;
      }

      if (isExpired(license.expiresAt)) {
        json(res, 403, { valid: false, reason: 'expired' });
        return;
      }

      const maxDevices = Math.max(1, Number(license.maxDevices || 1));
      const deviceRef = db.doc(`merchants/${merchantId}/devices/${requestedDeviceId}`);
      const registeredDeviceRef = deviceRef;

      await db.runTransaction(async (transaction) => {
        const currentDevice = await transaction.get(deviceRef);

        if (currentDevice.exists) {
          transaction.update(deviceRef, {
            lastSeenAt: Timestamp.now(),
            appVersion,
            status: 'active',
          });
          return;
        }

        const devicesSnap = await transaction.get(
          db.collection(`merchants/${merchantId}/devices`).where('status', '==', 'active'),
        );

        if (devicesSnap.size >= maxDevices) {
          const error = new Error('DEVICE_LIMIT_REACHED');
          throw error;
        }

        transaction.set(registeredDeviceRef, {
          merchantId,
          deviceId: requestedDeviceId,
          status: 'active',
          registeredAt: Timestamp.now(),
          lastSeenAt: Timestamp.now(),
          appVersion,
        });
      });

      const features = {
        ...defaultFeatures,
        ...(license.features && typeof license.features === 'object' ? license.features : {}),
      };

      json(res, 200, {
        valid: true,
        licenseId,
        merchantId,
        plan: license.plan || 'basic',
        features,
        expiresAt: toIso(license.expiresAt),
        maxDevices,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DEVICE_LIMIT_REACHED') {
        json(res, 403, { valid: false, reason: 'invalid' });
        return;
      }

      logger.error('validateLicense failed', error);
      json(res, 500, { valid: false, reason: 'invalid' });
    }
  },
);
