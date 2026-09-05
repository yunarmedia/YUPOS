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

  // Some BLE printers expose a vendor-specific service/characteristic. Discover any writable GATT channel as fallback.
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

export async function requestBluetoothPrinter(): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge pada perangkat yang mendukung Bluetooth BLE.');
  }

  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');

  // Chrome can reconnect to devices that the user has already authorized without asking for permission again.
  if (bluetooth.getDevices) {
    try {
      const authorized = await bluetooth.getDevices();
      if (authorized.length === 1) {
        try { return await connectDevice(authorized[0]); } catch { /* fall through to device picker */ }
      }
    } catch { /* fall through to picker */ }
  }

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

  // Keep packets small for compatibility with low-cost BLE thermal printers and their negotiated MTU.
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
  const bytes: number[] = [0x1b, 0x40]; // ESC @ initialize
  const text = (value: string) => bytes.push(...encoder.encode(value));
  const command = (...values: number[]) => bytes.push(...values);

  command(0x1b, 0x61, 0x01); // center
  command(0x1b, 0x45, 0x01); // bold
  text(safe(settings.storeName || 'YUPOS') + '\n');
  command(0x1b, 0x45, 0x00);
  if (settings.storeAddress) text(safe(settings.storeAddress) + '\n');
  if (settings.storePhone) text(safe(settings.storePhone) + '\n');
  text(line(width) + '\n');

  command(0x1b, 0x61, 0x00); // left
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
  command(0x1d, 0x56, 0x00); // cut

  return new Uint8Array(bytes);
}
