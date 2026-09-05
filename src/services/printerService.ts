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
  const properties = characteristic.properties;
  return Boolean(properties.write || properties.writeWithoutResponse);
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const profile of BLE_PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      for (const characteristicUuid of profile.characteristics) {
        try {
          const characteristic = await service.getCharacteristic(characteristicUuid);
          if (isWritable(characteristic)) return characteristic;
        } catch { /* continue */ }
      }
      try {
        const writable = (await service.getCharacteristics()).find(isWritable);
        if (writable) return writable;
      } catch { /* continue */ }
    } catch { /* continue */ }
  }

  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const writable = (await service.getCharacteristics()).find(isWritable);
        if (writable) return writable;
      } catch { /* ignore inaccessible service */ }
    }
  } catch { /* browser/firmware restriction */ }

  return null;
}

async function connectDevice(device: BluetoothDevice): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi GATT/BLE.');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    try { device.gatt.disconnect(); } catch { /* ignore */ }
    throw new Error('Printer terdeteksi, tetapi channel BLE untuk ESC/POS tidak ditemukan. Pastikan printer mendukung Bluetooth BLE/ESC-POS.');
  }
  return { device, characteristic };
}

function showYuposBluetoothDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('yupos-bluetooth-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'yupos-bluetooth-dialog';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex', 'align-items:center', 'justify-content:center',
      'padding:20px', 'background:rgba(15,23,42,.58)', 'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
      'font-family:Plus Jakarta Sans,Inter,system-ui,-apple-system,sans-serif'
    ].join(';');

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" style="width:min(420px,100%);background:#fff;border:1px solid #dbe4f0;border-radius:24px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden">
        <div style="padding:22px 22px 18px;background:linear-gradient(135deg,#eff6ff,#ffffff 60%);border-bottom:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:48px;height:48px;border-radius:15px;background:#2563eb;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(37,99,235,.25)">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10-5 5V2l5 5L7 17"/><path d="M4 9l8 8"/><path d="M4 15l8-8"/></svg>
            </div>
            <div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;letter-spacing:-.02em">Hubungkan Printer Bluetooth</div>
              <div style="font-size:11px;font-weight:700;color:#64748b;margin-top:3px">YUPOS • Printer Kasir / Dapur</div>
            </div>
          </div>
        </div>
        <div style="padding:20px 22px 22px">
          <div style="display:flex;gap:12px;padding:13px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:15px">
            <div style="font-size:18px">📡</div>
            <div style="font-size:12px;line-height:1.55;color:#475569;font-weight:600">YUPOS akan membuka pemilih perangkat Bluetooth untuk menemukan printer yang tersedia di sekitar perangkat Anda.</div>
          </div>
          <div style="margin-top:12px;font-size:11px;color:#94a3b8;font-weight:600">Gunakan printer Bluetooth <b style="color:#64748b">BLE / ESC-POS</b> dan pastikan printer menyala.</div>
          <div style="display:flex;gap:10px;margin-top:20px">
            <button id="yupos-bt-cancel" type="button" style="flex:1;padding:12px;border-radius:13px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:12px;font-weight:800">Batal</button>
            <button id="yupos-bt-continue" type="button" style="flex:1.35;padding:12px;border-radius:13px;border:0;background:#2563eb;color:white;font-size:12px;font-weight:900;box-shadow:0 8px 18px rgba(37,99,235,.22)">Pilih Printer Bluetooth</button>
          </div>
        </div>
      </div>
    `;

    const cleanup = (value: boolean) => {
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(false);
    });
    overlay.querySelector('#yupos-bt-cancel')?.addEventListener('click', () => cleanup(false));
    overlay.querySelector('#yupos-bt-continue')?.addEventListener('click', () => cleanup(true));
    document.body.appendChild(overlay);
  });
}

/** Open a YUPOS-styled confirmation first, then Chrome's required native Web Bluetooth chooser. */
export async function requestBluetoothPrinter(): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge pada perangkat yang mendukung Bluetooth BLE.');
  }

  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');

  const shouldContinue = await showYuposBluetoothDialog();
  if (!shouldContinue) throw new Error('User cancelled');

  // Must be called from the user's button flow; Chrome owns the actual device chooser UI.
  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  });

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

export async function sendBluetoothData(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array): Promise<void> {
  if (!characteristic) throw new Error('Characteristic printer tidak tersedia.');
  if (!characteristic.service.device.gatt?.connected) throw new Error('Printer Bluetooth tidak sedang terhubung.');

  const maxChunkSize = 180;
  for (let offset = 0; offset < data.length; offset += maxChunkSize) {
    const chunk = data.slice(offset, Math.min(offset + maxChunkSize, data.length));
    if (characteristic.properties.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === 'function') {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.properties.write) {
      await characteristic.writeValue(chunk);
    } else {
      throw new Error('Channel printer tidak memiliki izin write.');
    }
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

function line(width: number): string { return '-'.repeat(width); }
function columns(left: string, right: string, width: number): string {
  const safeRight = right.slice(0, width);
  const l = left.slice(0, Math.max(0, width - safeRight.length - 1));
  return l + ' '.repeat(Math.max(1, width - l.length - safeRight.length)) + safeRight;
}

export function buildReceiptEscPos(order: Order, settings: StoreSettings): Uint8Array {
  const width = settings.printerPaperWidth === '80mm' ? 48 : 32;
  const encoder = new TextEncoder();
  const safe = (value: unknown) => String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
  const money = (value: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
  const bytes: number[] = [0x1b, 0x40];
  const text = (value: string) => bytes.push(...encoder.encode(value));
  const command = (...values: number[]) => bytes.push(...values);

  command(0x1b, 0x61, 0x01);
  command(0x1b, 0x45, 0x01);
  text(safe(settings.storeName || 'YUPOS') + '\n');
  command(0x1b, 0x45, 0x00);
  if (settings.storeAddress) text(safe(settings.storeAddress) + '\n');
  if (settings.storePhone) text(safe(settings.storePhone) + '\n');
  text(line(width) + '\n');

  command(0x1b, 0x61, 0x00);
  text(`No : ${safe(order.id)}\n`);
  text(`Tgl: ${safe(order.date)} ${safe(order.time)}\n`);
  text(`Kasir: ${safe(order.cashierName)}\n`);
  if (order.customer && order.customer !== 'Pelanggan') text(`Customer: ${safe(order.customer)}\n`);
  text(line(width) + '\n');

  for (const item of order.items) {
    text(safe(item.name).slice(0, width) + '\n');
    text(columns(`${item.qty} x ${money(item.price)}`, money(item.qty * item.price), width) + '\n');
    if (item.note) text(`  Catatan: ${safe(item.note).slice(0, width - 2)}\n`);
  }

  text(line(width) + '\n');
  text(columns('Subtotal', money(order.subtotal), width) + '\n');
  if (order.discount > 0) text(columns('Diskon', `-${money(order.discount)}`, width) + '\n');
  if ((order.ppn ?? 0) > 0) text(columns(`PPN ${order.ppnRate ?? ''}%`, money(order.ppn ?? 0), width) + '\n');
  command(0x1b, 0x45, 0x01);
  text(columns('TOTAL', money(order.total), width) + '\n');
  command(0x1b, 0x45, 0x00);
  text(columns('Pembayaran', safe(order.payment), width) + '\n');
  text(line(width) + '\n');
  command(0x1b, 0x61, 0x01);
  text(safe(settings.footer || 'Terima kasih') + '\n');
  text('Powered by YUPOS\n\n\n');
  command(0x1d, 0x56, 0x00);

  return new Uint8Array(bytes);
}
