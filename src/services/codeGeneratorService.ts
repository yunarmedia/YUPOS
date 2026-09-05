import QRCode from 'qrcode';

const QUICKCHART_QR_ENDPOINT = 'https://quickchart.io/qr';
const QUICKCHART_BARCODE_ENDPOINT = 'https://quickchart.io/barcode';

export function getExternalQrUrl(value: string, size = 600): string {
  const params = new URLSearchParams({ text: value, format: 'png', size: String(size), margin: '4', ecLevel: 'H', dark: '000000', light: 'ffffff' });
  return `${QUICKCHART_QR_ENDPOINT}?${params.toString()}`;
}

export function getExternalQrSvgUrl(value: string, size = 600): string {
  const params = new URLSearchParams({ text: value, format: 'svg', size: String(size), margin: '4', ecLevel: 'H', dark: '000000', light: 'ffffff' });
  return `${QUICKCHART_QR_ENDPOINT}?${params.toString()}`;
}

export function getExternalBarcodeUrl(value: string, width = 900, height = 240): string {
  const params = new URLSearchParams({ type: 'code128', text: value, format: 'png', width: String(width), height: String(height), includeText: 'false' });
  return `${QUICKCHART_BARCODE_ENDPOINT}?${params.toString()}`;
}

export function getExternalBarcodeSvgUrl(value: string, width = 900, height = 240): string {
  const params = new URLSearchParams({ type: 'code128', text: value, format: 'svg', width: String(width), height: String(height), includeText: 'false' });
  return `${QUICKCHART_BARCODE_ENDPOINT}?${params.toString()}`;
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error(`Generator gambar merespons HTTP ${response.status}.`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca gambar generator eksternal.'));
    reader.readAsDataURL(blob);
  });
}

export async function buildLocalQrDataUrl(value: string, size = 600): Promise<string> {
  return QRCode.toDataURL(value, { width: size, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
}

// Local-first: Bluetooth receipt printing no longer depends on QuickChart, internet, CORS, or an API key.
export async function fetchExternalOrLocalQrDataUrl(value: string, size = 600): Promise<string> {
  try {
    return await buildLocalQrDataUrl(value, size);
  } catch {
    return fetchImageAsDataUrl(getExternalQrUrl(value, size));
  }
}
