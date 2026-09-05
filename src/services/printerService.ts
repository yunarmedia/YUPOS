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

/**
 * YUPOS-branded pre-dialog for the Bluetooth flow.
 * Important: the native requestDevice() call must happen directly from the
 * user's click handler. Resolving a Promise first can lose Chrome's user gesture.
 */
function showYuposBluetoothDialog(
  openNativeChooser: () => Promise<BluetoothDevice>,
  deviceType: 'kasir' | 'dapur',
): Promise<BluetoothDevice | null> {
  return new Promise((resolve) => {
    const existing = document.getElementById('yupos-bluetooth-dialog');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'yupos-bluetooth-dialog';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex', 'align-items:center', 'justify-content:center',
      'padding:18px', 'background:rgba(2,6,23,.64)', 'backdrop-filter:blur(10px)', '-webkit-backdrop-filter:blur(10px)',
      'font-family:Plus Jakarta Sans,Inter,system-ui,-apple-system,sans-serif'
    ].join(';');

    const printerLabel = deviceType === 'dapur' ? 'Printer Dapur' : 'Printer Kasir';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="yupos-bt-title" style="width:min(430px,100%);background:#fff;border:1px solid rgba(148,163,184,.22);border-radius:26px;box-shadow:0 28px 90px rgba(2,6,23,.34);overflow:hidden">
        <div style="padding:24px 22px 20px;background:linear-gradient(145deg,#eff6ff 0%,#ffffff 68%);border-bottom:1px solid #e8eef6">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
            <div style="width:52px;height:52px;flex:0 0 52px;border-radius:17px;background:linear-gradient(145deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(37,99,235,.26)">
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10-5 5V2l5 5L7 17"/><path d="M4 9l8 8"/><path d="M4 15l8-8"/></svg>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:17px;line-height:1.25;font-weight:900;color:#0f172a;letter-spacing:-.025em" id="yupos-bt-title">Hubungkan Printer</div>
              <div style="display:flex;align-items:center;gap:7px;margin-top:6px;font-size:11px;font-weight:800;color:#64748b">
                <span style="padding:4px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8">YUPOS</span>
                <span>${printerLabel}</span>
              </div>
            </div>
          </div>
        </div>
        <div style="padding:20px 22px 22px">
          <div style="display:flex;gap:12px;align-items:flex-start;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px">
            <div style="width:34px;height:34px;flex:0 0 34px;border-radius:11px;background:#e0ecff;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:16px">⌁</div>
            <div>
              <div style="font-size:12px;line-height:1.45;color:#1e293b;font-weight:850">Pilih perangkat Bluetooth</div>
              <div style="margin-top:3px;font-size:11px;line-height:1.55;color:#64748b;font-weight:600">YUPOS akan membuka pemilih perangkat resmi Chrome untuk mencari printer di sekitar Anda.</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:13px;font-size:10.5px;line-height:1.5;color:#94a3b8;font-weight:650">
            <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span>
            Printer harus menyala dan mendukung Bluetooth BLE / ESC-POS.
          </div>
          <div style="display:flex;gap:10px;margin-top:21px">
            <button id="yupos-bt-cancel" type="button" style="flex:1;min-height:46px;padding:11px 12px;border-radius:14px;border:1px solid #dbe3ee;background:#f8fafc;color:#475569;font-size:12px;font-weight:850">Batal</button>
            <button id="yupos-bt-continue" type="button" style="flex:1.45;min-height:46px;padding:11px 14px;border-radius:14px;border:0;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:12px;font-weight:900;box-shadow:0 9px 22px rgba(37,99,235,.24)">Pilih Printer Bluetooth</button>
          </div>
        </div>
      </div>
    `;

    const cancel = () => {
      overlay.remove();
      resolve(null);
    };

    const continueButton = overlay.querySelector<HTMLButtonElement>('#yupos-bt-continue');
    const cancelButton = overlay.querySelector<HTMLButtonElement>('#yupos-bt-cancel');

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cancel();
    });
    cancelButton?.addEventListener('click', cancel);
    continueButton?.addEventListener('click', async () => {
      if (!continueButton) return;
      continueButton.disabled = true;
      cancelButton?.setAttribute('disabled', 'true');
      continueButton.style.opacity = '.72';
      continueButton.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;gap:8px">
          <span style="width:13px;height:13px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;display:inline-block;animation:yuposBtSpin .7s linear infinite"></span>
          Membuka Bluetooth...
        </span>
      `;

      try {
        // This is intentionally the first awaited API after the user's click.
        const device = await openNativeChooser();
        overlay.remove();
        resolve(device);
      } catch (error) {
        // Keep the YUPOS dialog in control if Chrome chooser is cancelled/blocked.
        continueButton.disabled = false;
        cancelButton?.removeAttribute('disabled');
        continueButton.style.opacity = '1';
        continueButton.textContent = 'Pilih Printer Bluetooth';
        const message = error instanceof Error ? error.message : '';
        if (message !== 'User cancelled' && !/cancel/i.test(message)) {
          const note = document.createElement('div');
          note.style.cssText = 'margin-top:10px;padding:9px 11px;border-radius:11px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:10.5px;font-weight:700;line-height:1.45';
          note.textContent = 'Pemilih Bluetooth tidak dapat dibuka. Pastikan menggunakan Chrome HTTPS dan Bluetooth aktif.';
          continueButton.parentElement?.before(note);
        }
      }
    });

    const style = document.createElement('style');
    style.id = 'yupos-bt-dialog-style';
    style.textContent = '@keyframes yuposBtSpin{to{transform:rotate(360deg)}}#yupos-bluetooth-dialog button{font-family:inherit;cursor:pointer;transition:transform .15s ease,opacity .15s ease,background .15s ease}#yupos-bluetooth-dialog button:not(:disabled):active{transform:scale(.98)}#yupos-bluetooth-dialog button:disabled{cursor:default}';
    document.head.appendChild(style);
    overlay.appendChild(style);
    document.body.appendChild(overlay);
    continueButton?.focus();
  });
}

/** Open the YUPOS-styled confirmation, then Chrome's required native device chooser. */
export async function requestBluetoothPrinter(deviceType: 'kasir' | 'dapur' = 'kasir'): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge pada perangkat yang mendukung Bluetooth BLE.');
  }

  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');

  const device = await showYuposBluetoothDialog(
    () => bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES }),
    deviceType,
  );
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
