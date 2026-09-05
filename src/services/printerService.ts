import { Order, StoreSettings } from '../types';

// Common BLE profiles used by 58/80mm ESC/POS thermal printers.
export const BLE_PRINTER_PROFILES = [
  { name: 'Generic ESC/POS', service: '000018f0-0000-1000-8000-00805f9b34fb', characteristics: ['00002af1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Generic FFE0', service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristics: ['0000ffe1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Nordic UART', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', characteristics: ['6e400002-b5a3-f393-e0a9-e50e24dcca9e'] },
  { name: 'Serial Port', service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', characteristics: ['49535343-8841-43f4-a8d4-ecbe34729bb3'] },
] as const;

const OPTIONAL_SERVICES = BLE_PRINTER_PROFILES.map((profile) => profile.service);

function isWritable(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
  const properties = characteristic.properties;
  return Boolean(properties.write || properties.writeWithoutResponse);
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  // First try known printer profiles.
  for (const profile of BLE_PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      for (const characteristicUuid of profile.characteristics) {
        try {
          const characteristic = await service.getCharacteristic(characteristicUuid);
          if (isWritable(characteristic)) return characteristic;
        } catch { /* try next characteristic */ }
      }

      // Some printer firmware uses a different writable characteristic inside the same service.
      try {
        const characteristics = await service.getCharacteristics();
        const writable = characteristics.find(isWritable);
        if (writable) return writable;
      } catch { /* continue */ }
    } catch { /* try next profile */ }
  }

  // Last-resort discovery: inspect every primary service and select a writable characteristic.
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        const writable = characteristics.find(isWritable);
        if (writable) return writable;
      } catch { /* ignore inaccessible service */ }
    }
  } catch { /* browser/firmware may restrict service enumeration */ }

  return null;
}

export async function requestBluetoothPrinter(): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge pada perangkat yang mendukung Bluetooth BLE.');
  }

  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');

  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  });

  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi GATT/BLE.');
  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);

  if (!characteristic) {
    try { device.gatt.disconnect(); } catch { /* ignore */ }
    throw new Error('Printer terdeteksi, tetapi tidak ditemukan channel BLE yang dapat menerima data ESC/POS. Pastikan printer mendukung Bluetooth BLE/ESC-POS.');
  }

  return { device, characteristic };
}

export async function reconnectBluetoothPrinter(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> {
  if (!device.gatt) throw new Error('GATT printer tidak tersedia.');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) throw new Error('Channel cetak BLE tidak ditemukan.');
  return characteristic;
}

export async function getPreviouslyAuthorizedPrinters(): Promise<BluetoothDevice[]> {
  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as (Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> }) | undefined;
  if (!bluetooth?.getDevices) return [];
  try { return await bluetooth.getDevices(); } catch { return []; }
}

export async function sendBluetoothData(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array): Promise<void> {
  if (!characteristic) throw new Error('Characteristic printer tidak tersedia.');
  if (!characteristic.service.device.gatt?.connected) throw new Error('Printer Bluetooth tidak sedang terhubung.');

  // BLE MTU varies by device. Small chunks are more compatible with inexpensive thermal printers.
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
function center(value: string, width: number): string {
  const text = value.slice(0, width);
  const left = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(left) + text;
}
function columns(left: string, right: string, width: number): string {
  const l = left.slice(0, Math.max(0, width - right.length - 1));
  return l + ' '.repeat(Math.max(1, width - l.length - right.length)) + right.slice(-width);
}

export function buildReceiptEscPos(order: Order, settings: StoreSettings): Uint8Array {
  const width = settings.printerPaperWidth === '80mm' ? 48 : 32;
  const encoder = new TextEncoder();
  const safe = (value: unknown) => String(value ?? '').replace(/[\u0000-\u001F]/g, ' ').trim();
  const money = (value: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
  const output: string[] = [];

  // ESC/POS commands are kept as raw bytes below. Text remains plain ASCII-compatible Indonesian.
  const bytes: number[] = [0x1b, 0x40]; // initialize
  const text = (value: string) => bytes.push(...encoder.encode(value));
  const command = (...values: number[]) => bytes.push(...values);

  command(0x1b, 0x61, 0x01); // center
  command(0x1b, 0x45, 0x01); // bold on
  text(safe(settings.storeName || 'YUPOS') + '\n');
  command(0x1b, 0x45, 0x00); // bold off
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
    const itemName = safe(item.name);
    text(itemName.slice(0, width) + '\n');
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
  command(0x1d, 0x56, 0x00); // full cut

  return new Uint8Array(bytes);
}
