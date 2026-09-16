export type LicensePlan = 'basic' | 'pro' | 'lifetime';
export type LicenseStatus = 'pending' | 'active' | 'expired' | 'suspended' | 'revoked';

export interface LicenseFeatures {
  pos: boolean;
  inventory: boolean;
  reports: boolean;
  printer: boolean;
  customer: boolean;
  excelExport: boolean;
}

export interface ValidateLicenseRequest {
  deviceId: string;
  appVersion?: string;
}
