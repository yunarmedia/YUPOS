export const BLE_PRINTER_SERVICES = {
  nordicUart: {
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    characteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  },
  generic: {
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
} as const;

export async function requestBluetoothPrinter(): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Bluetooth Web API tidak didukung oleh browser ini.');
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      BLE_PRINTER_SERVICES.nordicUart.service,
      BLE_PRINTER_SERVICES.generic.service,
    ],
  });

  if (!device.gatt) throw new Error('GATT Bluetooth tidak tersedia pada perangkat.');
  const server = await device.gatt.connect();

  const candidates = [BLE_PRINTER_SERVICES.nordicUart, BLE_PRINTER_SERVICES.generic];
  for (const candidate of candidates) {
    try {
      const service = await server.getPrimaryService(candidate.service);
      const characteristic = await service.getCharacteristic(candidate.characteristic);
      return { device, characteristic };
    } catch {
      // Try the next known printer profile.
    }
  }

  throw new Error('Service printer Bluetooth tidak ditemukan pada perangkat.');
}

export async function sendBluetoothData(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  if (!characteristic) throw new Error('Characteristic printer tidak tersedia.');

  const maxChunkSize = 180;
  for (let offset = 0; offset < data.length; offset += maxChunkSize) {
    const chunk = data.slice(offset, offset + maxChunkSize);
    if (typeof characteristic.writeValueWithoutResponse === 'function') {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}

export function buildReceiptEscPos(lines: string[], paperWidth = 32): Uint8Array {
  const encoder = new TextEncoder();
  const normalized = lines.map((line) => {
    const value = String(line ?? '');
    return value.length > paperWidth ? value.slice(0, paperWidth) : value;
  });

  const payload = [
    '\x1b@',
    ...normalized.map((line) => `${line}\n`),
    '\n\n\x1dV\x00',
  ].join('');

  return encoder.encode(payload);
}
