import QRCode from 'qrcode';

/**
 * Local-only QR generation for YUPOS receipts.
 * No QuickChart request, API key, network, or CORS dependency is required.
 */
export async function buildLocalQrDataUrl(value: string, size = 900): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export async function fetchExternalOrLocalQrDataUrl(value: string, size = 900): Promise<string> {
  return buildLocalQrDataUrl(value, size);
}
