import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MerchantProfile, MerchantLicenseStatus } from '../types';

export async function getMerchantProfile(uid: string): Promise<MerchantProfile | null> {
  const id = String(uid || '').trim();
  if (!id || id === 'default' || id === '' || id === 'merchant_default') return null;

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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * YUPOS uses lifetime licenses: an active merchant remains licensed until
 * the developer/admin changes the license status.
 */
export function isMerchantLicenseActive(profile: MerchantProfile | null): boolean {
  return !!profile && profile.licenseStatus === 'active';
}

export function getLicenseMessage(profile: MerchantProfile | null): string {
  if (!profile) return 'Akun Anda belum terdaftar sebagai merchant YUPOS. Hubungi Developer untuk aktivasi lisensi.';
  if (profile.licenseStatus === 'suspended') return 'Lisensi YUPOS Anda sedang ditangguhkan. Hubungi Developer.';
  if (profile.licenseStatus === 'pending') return 'Lisensi YUPOS Anda belum diaktifkan. Hubungi Developer.';
  return '';
}
