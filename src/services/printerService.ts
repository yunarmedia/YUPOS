import QRCode from 'qrcode';
import { Order, StoreSettings } from '../types';

export const BLE_PRINTER_PROFILES = [
  { name: 'Generic ESC/POS', service: '000018f0-0000-1000-8000-00805f9b34fb', characteristics: ['00002af1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Generic FFE0', service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristics: ['0000ffe1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Nordic UART', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', characteristics: ['6e400002-b5a3-f393-e0a9-e50e24dcca9e'] },
  { name: 'Serial Port', service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', characteristics: ['49535343-8841-43f4-a8d4-ecbe34729bb3'] },
] as const;
const OPTIONAL_SERVICES = BLE_PRINTER_PROFILES.map((profile) => profile.service);
type BluetoothWithGetDevices = Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> };

function isWritable(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  return Boolean(characteristic.properties.write || characteristic.properties.writeWithoutResponse);
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const profile of BLE_PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      for (const uuid of profile.characteristics) {
        try {
          const characteristic = await service.getCharacteristic(uuid);
          if (isWritable(characteristic)) return characteristic;
        } catch {}
      }
      try {
        const writable = (await service.getCharacteristics()).find(isWritable);
        if (writable) return writable;
      } catch {}
    } catch {}
  }
  try {
    for (const service of await server.getPrimaryServices()) {
      try {
        const writable = (await service.getCharacteristics()).find(isWritable);
        if (writable) return writable;
      } catch {}
    }
  } catch {}
  return null;
}

async function connectDevice(device: BluetoothDevice): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi GATT/BLE.');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    try { device.gatt.disconnect(); } catch {}
    throw new Error('Channel BLE ESC/POS printer tidak ditemukan. Pastikan printer mendukung Bluetooth BLE/ESC-POS.');
  }
  return { device, characteristic };
}

function showYuposBluetoothDialog(openNativeChooser: () => Promise<BluetoothDevice>, deviceType: 'kasir' | 'dapur'): Promise<BluetoothDevice | null> {
  return new Promise((resolve) => {
    const existing = document.getElementById('yupos-bluetooth-dialog');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'yupos-bluetooth-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.64);backdrop-filter:blur(10px);font-family:Plus Jakarta Sans,Inter,system-ui,sans-serif';
    const label = deviceType === 'dapur' ? 'Printer Dapur' : 'Printer Kasir';
    overlay.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(430px,100%);background:#fff;border-radius:26px;box-shadow:0 28px 90px rgba(2,6,23,.34);overflow:hidden"><div style="padding:24px 22px 20px;background:linear-gradient(145deg,#eff6ff,#fff 68%);border-bottom:1px solid #e8eef6"><div style="display:flex;gap:14px;align-items:center"><div style="width:52px;height:52px;flex:0 0 52px;border-radius:17px;background:linear-gradient(145deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px">⌁</div><div><div style="font-size:17px;font-weight:900;color:#0f172a">Hubungkan Printer</div><div style="display:flex;gap:7px;margin-top:6px;font-size:11px;font-weight:800;color:#64748b"><span style="padding:4px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8">YUPOS</span><span>${label}</span></div></div></div></div><div style="padding:20px 22px 22px"><div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;font-size:11px;line-height:1.55;color:#64748b;font-weight:600">Pilih perangkat Bluetooth pada pemilih resmi Chrome. Printer harus menyala dan mendukung BLE / ESC-POS.</div><div style="display:flex;gap:10px;margin-top:21px"><button id="yupos-bt-cancel" type="button" style="flex:1;min-height:46px;border-radius:14px;border:1px solid #dbe3ee;background:#f8fafc;color:#475569;font-weight:850">Batal</button><button id="yupos-bt-continue" type="button" style="flex:1.45;min-height:46px;border:0;border-radius:14px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:900">Pilih Printer Bluetooth</button></div></div></div>`;
    const cancel = () => { overlay.remove(); resolve(null); };
    const continueButton = overlay.querySelector<HTMLButtonElement>('#yupos-bt-continue');
    const cancelButton = overlay.querySelector<HTMLButtonElement>('#yupos-bt-cancel');
    cancelButton?.addEventListener('click', cancel);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) cancel(); });
    continueButton?.addEventListener('click', async () => {
      if (!continueButton) return;
      continueButton.disabled = true;
      cancelButton?.setAttribute('disabled', 'true');
      continueButton.textContent = 'Membuka Bluetooth...';
      try { const device = await openNativeChooser(); overlay.remove(); resolve(device); }
      catch (error) {
        continueButton.disabled = false;
        cancelButton?.removeAttribute('disabled');
        continueButton.textContent = 'Pilih Printer Bluetooth';
        if (!/cancel/i.test(error instanceof Error ? error.message : '')) {
          const note = document.createElement('div');
          note.style.cssText = 'margin-top:10px;padding:9px 11px;border-radius:11px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:10.5px;font-weight:700';
          note.textContent = 'Pemilih Bluetooth tidak dapat dibuka. Pastikan Chrome HTTPS dan Bluetooth aktif.';
          continueButton.parentElement?.before(note);
        }
      }
    });
    document.body.appendChild(overlay);
    continueButton?.focus();
  });
}

export async function requestBluetoothPrinter(deviceType: 'kasir' | 'dapur' = 'kasir'): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge dengan Bluetooth BLE.');
  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');
  const device = await showYuposBluetoothDialog(() => bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES }), deviceType);
  if (!device) throw new Error('User cancelled');
  return connectDevice(device);
}

export async function reconnectBluetoothPrinter(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  return (await connectDevice(device)).characteristic;
}

export async function getPreviouslyAuthorizedPrinters(): Promise<BluetoothDevice[]> {
  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth?.getDevices) return [];
  try { return await bluetooth.getDevices(); } catch { return []; }
}

export async function sendBluetoothData(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array | PromiseLike<Uint8Array>): Promise<void> {
  if (!characteristic) throw new Error('Characteristic printer tidak tersedia.');
  const payload = await data;
  if (!characteristic.service.device.gatt?.connected) throw new Error('Printer Bluetooth tidak sedang terhubung.');
  const maxChunkSize = 180;
  for (let offset = 0; offset < payload.length; offset += maxChunkSize) {
    const chunk = payload.slice(offset, Math.min(offset + maxChunkSize, payload.length));
    if (characteristic.properties.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === 'function') await characteristic.writeValueWithoutResponse(chunk);
    else if (characteristic.properties.write) await characteristic.writeValue(chunk);
    else throw new Error('Channel printer tidak memiliki izin write.');
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

function line(width: number): string { return '-'.repeat(width); }
function columns(left: string, right: string, width: number): string {
  const safeRight = right.slice(0, width);
  const l = left.slice(0, Math.max(0, width - safeRight.length - 1));
  return l + ' '.repeat(Math.max(1, width - l.length - safeRight.length)) + safeRight;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memuat gambar printer.'));
    image.src = src;
  });
}

function imageToEscPosRaster(source: HTMLCanvasElement, maxWidth: number): Uint8Array {
  const scale = Math.min(1, maxWidth / source.width);
  const width = Math.max(8, Math.floor(source.width * scale / 8) * 8);
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas printer tidak tersedia.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = width / 8;
  const raster = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3] / 255;
      const luminance = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) * alpha + 255 * (1 - alpha);
      if (luminance < 185) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const command = new Uint8Array(8 + raster.length);
  command.set([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff]);
  command.set(raster, 8);
  return command;
}

function makeQrRaster(value: string, maxWidth: number): Uint8Array {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const quiet = 4;
  const modulePx = Math.max(3, Math.floor(maxWidth / (modules + quiet * 2)));
  const size = (modules + quiet * 2) * modulePx;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas QR printer tidak tersedia.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.modules.data[row * modules + col]) ctx.fillRect((col + quiet) * modulePx, (row + quiet) * modulePx, modulePx, modulePx);
    }
  }
  return imageToEscPosRaster(canvas, maxWidth);
}

function center(command: (...values: number[]) => void, text: (value: string) => void, value: string): void {
  command(0x1b, 0x61, 0x01);
  text(value + '\n');
  command(0x1b, 0x61, 0x00);
}

export async function buildReceiptEscPos(order: Order, settings: StoreSettings): Promise<Uint8Array> {
  const paperChars = settings.printerPaperWidth === '80mm' ? 48 : 32;
  const pixelWidth = settings.printerPaperWidth === '80mm' ? 576 : 384;
  const encoder = new TextEncoder();
  const safe = (value: unknown) => String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
  const money = (value: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value || 0))}`;
  const bytes: number[] = [0x1b, 0x40];
  const text = (value: string) => bytes.push(...encoder.encode(value));
  const command = (...values: number[]) => bytes.push(...values);
  const append = (data: Uint8Array) => bytes.push(...data);

  if (settings.logoBase64) {
    try {
      const logo = await loadImage(settings.logoBase64);
      const maxLogoWidth = Math.round(pixelWidth * 0.62);
      const scale = Math.min(maxLogoWidth / logo.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(8, Math.floor(logo.width * scale / 8) * 8);
      canvas.height = Math.max(1, Math.round(logo.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(logo, 0, 0, canvas.width, canvas.height);
        command(0x1b, 0x61, 0x01);
        append(imageToEscPosRaster(canvas, maxLogoWidth));
        text('\n');
        command(0x1b, 0x61, 0x00);
      }
    } catch (error) { console.warn('YUPOS printer logo skipped:', error); }
  }

  command(0x1b, 0x61, 0x01);
  command(0x1b, 0x45, 0x01);
  text(safe(settings.storeName || 'YUPOS') + '\n');
  command(0x1b, 0x45, 0x00);
  if (settings.storeAddress) text(safe(settings.storeAddress) + '\n');
  if (settings.storePhone) text(safe(settings.storePhone) + '\n');
  text(line(paperChars) + '\n');
  command(0x1b, 0x61, 0x00);
  text(`No : ${safe(order.id)}\n`);
  text(`Tgl: ${safe(order.date)} ${safe(order.time)}\n`);
  text(`Kasir: ${safe(order.cashierName)}\n`);
  if (order.customer && order.customer !== 'Pelanggan') text(`Customer: ${safe(order.customer)}\n`);
  text(line(paperChars) + '\n');

  for (const item of order.items) {
    text(safe(item.name).slice(0, paperChars) + '\n');
    text(columns(`${item.qty} x ${money(item.price)}`, money(item.qty * item.price), paperChars) + '\n');
    if (item.note) text(`  Catatan: ${safe(item.note).slice(0, paperChars - 2)}\n`);
  }

  text(line(paperChars) + '\n');
  text(columns('Subtotal', money(order.subtotal), paperChars) + '\n');
  if (order.discount > 0) text(columns('Diskon', `-${money(order.discount)}`, paperChars) + '\n');
  if ((order.ppn ?? 0) > 0) text(columns(`PPN ${order.ppnRate ?? 11}%`, money(order.ppn ?? 0), paperChars) + '\n');
  command(0x1b, 0x45, 0x01);
  text(columns('TOTAL', money(order.total), paperChars) + '\n');
  command(0x1b, 0x45, 0x00);
  text(columns('Pembayaran', safe(order.payment).toUpperCase(), paperChars) + '\n');

  if (settings.businessType === 'barbershop' && order.customerIsMember && order.customerCode) {
    try {
      const { loadCustomers } = await import('./customerService');
      const { buildMembershipScanUrl } = await import('./membershipService');
      const customer = loadCustomers(order.merchantId || 'default_merchant').find((item) => item.customerCode === order.customerCode);
      if (customer) {
        text(line(paperChars) + '\n');
        center(command, text, 'MEMBERSHIP CUSTOMER');
        center(command, text, 'Scan QR untuk cek kunjungan & reward');
        command(0x1b, 0x61, 0x01);
        append(makeQrRaster(buildMembershipScanUrl(customer), Math.round(pixelWidth * 0.52)));
        text('\n');
        command(0x1b, 0x61, 0x00);
        center(command, text, `${customer.customerCode} • ${customer.visitCount}/10 KUNJUNGAN`);
      }
    } catch (error) { console.warn('YUPOS membership QR skipped:', error); }
  }

  text(line(paperChars) + '\n');
  center(command, text, safe(settings.footer || 'Terima kasih'));
  center(command, text, 'Powered by YUPOS');
  text('\n\n');
  command(0x1d, 0x56, 0x00);
  return new Uint8Array(bytes);
}
