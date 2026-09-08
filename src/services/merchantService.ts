import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MerchantProfile, MerchantLicenseStatus } from '../types';

export async function getMerchantProfile(uid: string): Promise<MerchantProfile | null> {
  const id = String(uid || '').trim();
  if (!id || id === 'default' || id === 'default_merchant' || id === 'merchant_default') return null;

  const snapshot = await getDoc(doc(db, 'merchants', id));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Partial<MerchantProfile>;
  return {
    uid: id,
    businessName: String(data.businessName || ''),
    businessType: data.businessType || 'custom',
    businessTypeCustom: data.businessTypeCustom,
    address: data.address,
    phone: data.phone,
    licenseStatus: (data.licenseStatus || 'pending') as MerchantLicenseStatus,
    licenseExpiresAt: data.licenseExpiresAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function isMerchantLicenseActive(profile: MerchantProfile | null): boolean {
  if (!profile || profile.licenseStatus !== 'active') return false;

  const expiry = profile.licenseExpiresAt as any;
  if (!expiry) return false;

  if (typeof expiry.toMillis === 'function') return expiry.toMillis() > Date.now();
  if (expiry instanceof Date) return expiry.getTime() > Date.now();
  if (typeof expiry === 'number') return expiry > Date.now();

  return false;
}

export function getLicenseMessage(profile: MerchantProfile | null): string {
  if (!profile) return 'Akun Anda belum terdaftar sebagai merchant YUPOS. Hubungi Developer untuk aktivasi lisensi.';
  if (profile.licenseStatus === 'suspended') return 'Lisensi YUPOS Anda sedang ditangguhkan. Hubungi Developer.';
  if (profile.licenseStatus === 'pending') return 'Lisensi YUPOS Anda belum diaktifkan. Hubungi Developer.';
  if (profile.licenseStatus === 'expired' || !isMerchantLicenseActive(profile)) return 'Lisensi YUPOS Anda sudah tidak aktif atau telah kedaluwarsa. Hubungi Developer.';
  return '';
}
