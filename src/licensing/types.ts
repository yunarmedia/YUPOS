export type LicensePlan = 'basic' | 'pro' | 'lifetime';

export type LicenseStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'revoked';

export interface LicenseFeatures {
  pos: boolean;
  inventory: boolean;
  reports: boolean;
  printer: boolean;
  customer: boolean;
  excelExport: boolean;
}

export interface License {
  id: string;
  licenseKey: string;
  merchantId: string;
  plan: LicensePlan;
  status: LicenseStatus;
  issuedAt: string;
  expiresAt: string | null;
  maxDevices: number;
  features: LicenseFeatures;
}

export interface LicenseValidationResult {
  valid: boolean;
  licenseId?: string;
  merchantId?: string;
  plan?: LicensePlan;
  features?: LicenseFeatures;
  expiresAt?: string | null;
  reason?:
    | 'missing'
    | 'expired'
    | 'suspended'
    | 'revoked'
    | 'invalid';
}
