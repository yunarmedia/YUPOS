import { Order, StoreSettings } from '../types';
import { drawCode128ToCanvas } from './barcodeService';
import { fetchExternalOrLocalQrDataUrl, fetchImageAsDataUrl, getExternalBarcodeUrl } from './codeGeneratorService';

export const BLE_PRINTER_PROFILES = [
  { name: 'Generic ESC/POS', service: '000018f0-0000-1000-8000-00805f9b34fb', characteristics: ['00002af1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Generic FFE0', service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristics: ['0000ffe1-0000-1000-8000-00805f9b34fb'] },
  { name: 'Nordic UART', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', characteristics: ['6e400002-b5a3-f393-e0a9-e50e24dcca9e'] },
  { name: 'Serial Port', service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', characteristics: ['49535343-8841-43f4-a8d4-ecbe34729bb3'] },
] as const;
const OPTIONAL_SERVICES = BLE_PRINTER_PROFILES.map((p) => p.service);
type BluetoothWithGetDevices = Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> };

function isWritable(c: BluetoothRemoteGATTCharacteristic): boolean { return Boolean(c.properties.write || c.properties.writeWithoutResponse); }
async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const profile of BLE_PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      for (const uuid of profile.characteristics) { try { const c = await service.getCharacteristic(uuid); if (isWritable(c)) return c; } catch {} }
      try { const c = (await service.getCharacteristics()).find(isWritable); if (c) return c; } catch {}
    } catch {}
  }
  try { for (const service of await server.getPrimaryServices()) { try { const c = (await service.getCharacteristics()).find(isWritable); if (c) return c; } catch {} } } catch {}
  return null;
}
async function connectDevice(device: BluetoothDevice): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi GATT/BLE.');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) { try { device.gatt.disconnect(); } catch {} throw new Error('Channel BLE ESC/POS printer tidak ditemukan.'); }
  return { device, characteristic };
}
function showYuposBluetoothDialog(openNativeChooser: () => Promise<BluetoothDevice>, deviceType: 'kasir' | 'dapur'): Promise<BluetoothDevice | null> {
  return new Promise((resolve) => {
    document.getElementById('yupos-bluetooth-dialog')?.remove();
    const overlay = document.createElement('div'); overlay.id = 'yupos-bluetooth-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.64);backdrop-filter:blur(10px);font-family:Plus Jakarta Sans,Inter,system-ui,sans-serif';
    const label = deviceType === 'dapur' ? 'Printer Dapur' : 'Printer Kasir';
    overlay.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(430px,100%);background:#fff;border-radius:26px;box-shadow:0 28px 90px rgba(2,6,23,.34);overflow:hidden"><div style="padding:24px 22px 20px;background:linear-gradient(145deg,#eff6ff,#fff 68%);border-bottom:1px solid #e8eef6"><div style="display:flex;gap:14px;align-items:center"><div style="width:52px;height:52px;border-radius:17px;background:linear-gradient(145deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px">⌁</div><div><div style="font-size:17px;font-weight:900;color:#0f172a">Hubungkan Printer</div><div style="display:flex;gap:7px;margin-top:6px;font-size:11px;font-weight:800;color:#64748b"><span style="padding:4px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8">YUPOS</span><span>${label}</span></div></div></div></div><div style="padding:20px 22px 22px"><div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;font-size:11px;line-height:1.55;color:#64748b;font-weight:600">Pilih perangkat Bluetooth pada pemilih resmi Chrome. Printer harus menyala dan mendukung BLE / ESC-POS.</div><div style="display:flex;gap:10px;margin-top:21px"><button id="yupos-bt-cancel" type="button" style="flex:1;min-height:46px;border-radius:14px;border:1px solid #dbe3ee;background:#f8fafc;color:#475569;font-weight:850">Batal</button><button id="yupos-bt-continue" type="button" style="flex:1.45;min-height:46px;border:0;border-radius:14px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:900">Pilih Printer Bluetooth</button></div></div></div>`;
    const cancel = () => { overlay.remove(); resolve(null); };
    const btn = overlay.querySelector<HTMLButtonElement>('#yupos-bt-continue'); const cancelBtn = overlay.querySelector<HTMLButtonElement>('#yupos-bt-cancel');
    cancelBtn?.addEventListener('click', cancel); overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
    btn?.addEventListener('click', async () => { if (!btn) return; btn.disabled = true; btn.textContent = 'Membuka Bluetooth...'; try { const d = await openNativeChooser(); overlay.remove(); resolve(d); } catch (e) { btn.disabled = false; btn.textContent = 'Pilih Printer Bluetooth'; if (!/cancel/i.test(e instanceof Error ? e.message : '')) { const n = document.createElement('div'); n.textContent = 'Pemilih Bluetooth tidak dapat dibuka. Pastikan Chrome HTTPS dan Bluetooth aktif.'; n.style.cssText = 'margin-top:10px;padding:9px 11px;border-radius:11px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:10.5px;font-weight:700'; btn.parentElement?.before(n); } } });
    document.body.appendChild(overlay); btn?.focus();
  });
}
export async function requestBluetoothPrinter(deviceType: 'kasir' | 'dapur' = 'kasir'): Promise<{ device: BluetoothDevice; characteristic: BluetoothRemoteGATTCharacteristic }> {
  if (!('bluetooth' in navigator)) throw new Error('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge dengan Bluetooth BLE.');
  const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined;
  if (!bluetooth) throw new Error('Bluetooth API tidak tersedia.');
  const device = await showYuposBluetoothDialog(() => bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES }), deviceType);
  if (!device) throw new Error('User cancelled'); return connectDevice(device);
}
export async function reconnectBluetoothPrinter(device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic> { return (await connectDevice(device)).characteristic; }
export async function getPreviouslyAuthorizedPrinters(): Promise<BluetoothDevice[]> { const b = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth as BluetoothWithGetDevices | undefined; if (!b?.getDevices) return []; try { return await b.getDevices(); } catch { return []; } }

export async function sendBluetoothData(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array | PromiseLike<Uint8Array>): Promise<void> {
  if (!characteristic) throw new Error('Characteristic printer tidak tersedia.');
  const payload = await data;
  if (!characteristic.service.device.gatt?.connected) throw new Error('Printer Bluetooth tidak sedang terhubung.');
  const maxChunkSize = 180;
  for (let offset = 0; offset < payload.length; offset += maxChunkSize) {
    const chunk = payload.slice(offset, Math.min(offset + maxChunkSize, payload.length));
    // Prefer acknowledged writes when supported to preserve strict receipt ordering.
    if (characteristic.properties.write && typeof characteristic.writeValue === 'function') await characteristic.writeValue(chunk);
    else if (characteristic.properties.writeWithoutResponse && typeof characteristic.writeValueWithoutResponse === 'function') await characteristic.writeValueWithoutResponse(chunk);
    else throw new Error('Channel printer tidak memiliki izin write.');
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
}
function line(width: number): string { return '-'.repeat(width); }
function columns(left: string, right: string, width: number): string { const r = right.slice(0, width); const l = left.slice(0, Math.max(0, width - r.length - 1)); return l + ' '.repeat(Math.max(1, width - l.length - r.length)) + r; }
function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Gagal memuat gambar printer.')); image.src = src; }); }
function imageToEscPosRaster(source: HTMLCanvasElement, maxWidth: number, smooth = false): Uint8Array {
  const scale = Math.min(1, maxWidth / source.width); const width = Math.max(8, Math.floor(source.width * scale / 8) * 8); const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Canvas printer tidak tersedia.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingEnabled = smooth; ctx.drawImage(source, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data; const bytesPerRow = width / 8; const raster = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; const a = pixels[i + 3] / 255; const lum = (pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114) * a + 255 * (1 - a); if (lum < 185) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7); }
  const command = new Uint8Array(8 + raster.length); command.set([0x1d,0x76,0x30,0x00,bytesPerRow & 255,(bytesPerRow >> 8) & 255,height & 255,(height >> 8) & 255]); command.set(raster, 8); return command;
}
async function makeQrRaster(value: string, targetWidth: number): Promise<Uint8Array> {
  const sourceSize = targetWidth * 3; const dataUrl = await fetchExternalOrLocalQrDataUrl(value, sourceSize); const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas'); canvas.width = sourceSize; canvas.height = sourceSize; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas QR printer tidak tersedia.');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,sourceSize,sourceSize); ctx.imageSmoothingEnabled = false; ctx.drawImage(image,0,0,sourceSize,sourceSize); return imageToEscPosRaster(canvas,targetWidth,false);
}
async function makeBarcodeRaster(value: string, targetWidth: number): Promise<Uint8Array> {
  const targetHeight = 96, sourceWidth = targetWidth * 3, sourceHeight = targetHeight * 3; const canvas = document.createElement('canvas'); canvas.width = sourceWidth; canvas.height = sourceHeight; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas barcode printer tidak tersedia.'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,sourceWidth,sourceHeight);
  try { const image = await loadImage(await fetchImageAsDataUrl(getExternalBarcodeUrl(value,900,240))); ctx.imageSmoothingEnabled=false; ctx.drawImage(image,0,0,sourceWidth,sourceHeight); } catch { drawCode128ToCanvas(ctx,value,0,0,sourceWidth,sourceHeight); }
  return imageToEscPosRaster(canvas,targetWidth,false);
}
function center(command: (...values:number[])=>void, text:(value:string)=>void, value:string):void { command(0x1b,0x61,0x01); text(value+'\n'); command(0x1b,0x61,0x00); }

export async function buildReceiptEscPos(order: Order, settings: StoreSettings): Promise<Uint8Array> {
  const paperChars = settings.printerPaperWidth === '80mm' ? 48 : 32; const pixelWidth = settings.printerPaperWidth === '80mm' ? 576 : 384; const qrWidth = settings.printerPaperWidth === '80mm' ? 288 : 240; const barcodeWidth = settings.printerPaperWidth === '80mm' ? 480 : 320;
  const encoder = new TextEncoder(); const safe = (v:unknown)=>String(v??'').replace(/[\u0000-\u001F]/g,' ').replace(/[^\x20-\x7E]/g,' ').trim(); const money=(v:number)=>`Rp${new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(Math.round(v||0))}`;
  const bytes:number[]=[0x1b,0x40,0x1b,0x33,0x26]; const text=(v:string)=>bytes.push(...encoder.encode(v)); const command=(...v:number[])=>bytes.push(...v); const append=(d:Uint8Array)=>bytes.push(...d);
  if(settings.logoBase64){try{const logo=await loadImage(settings.logoBase64);const maxLogoWidth=Math.round(pixelWidth*.62);const scale=Math.min(maxLogoWidth/logo.width,1);const c=document.createElement('canvas');c.width=Math.max(8,Math.floor(logo.width*scale/8)*8);c.height=Math.max(1,Math.round(logo.height*scale));const ctx=c.getContext('2d');if(ctx){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(logo,0,0,c.width,c.height);command(0x1b,0x61,1);append(imageToEscPosRaster(c,maxLogoWidth,true));text('\n');command(0x1b,0x61,0);}}catch(e){console.warn('YUPOS printer logo skipped:',e);}}
  command(0x1b,0x61,1); command(0x1b,0x45,1); text(safe(settings.storeName||'YUPOS')+'\n'); command(0x1b,0x45,0); if(settings.storeAddress)text(safe(settings.storeAddress)+'\n'); if(settings.storePhone)text(safe(settings.storePhone)+'\n'); text(line(paperChars)+'\n'); command(0x1b,0x61,0);
  text(`No : ${safe(order.id)}\n`); text(`Tgl: ${safe(order.date)} ${safe(order.time)}\n`); text(`Kasir: ${safe(order.cashierName||'Kasir')}\n`); if(order.customer&&order.customer!=='Pelanggan')text(`Customer: ${safe(order.customer)}\n`); text(line(paperChars)+'\n');
  for(const item of order.items){text(safe(item.name).slice(0,paperChars)+'\n');text(columns(`${item.qty} x ${money(item.price)}`,money(item.qty*item.price),paperChars)+'\n');if(item.note)text(`  Catatan: ${safe(item.note).slice(0,paperChars-2)}\n`);text('\n');}
  text(line(paperChars)+'\n'); text(columns('Subtotal',money(order.subtotal),paperChars)+'\n'); if(order.discount>0)text(columns('Diskon',`-${money(order.discount)}`,paperChars)+'\n'); if((order.ppn??0)>0)text(columns(`PPN ${order.ppnRate??11}%`,money(order.ppn??0),paperChars)+'\n'); command(0x1b,0x45,1); text(columns('TOTAL',money(order.total),paperChars)+'\n'); command(0x1b,0x45,0); text(columns('Pembayaran',safe(order.payment).toUpperCase(),paperChars)+'\n');
  if(settings.businessType==='barbershop'&&order.customerIsMember&&order.customerCode){try{const{loadCustomers}=await import('./customerService');const{buildMembershipScanUrl}=await import('./membershipService');const customer=loadCustomers(order.merchantId||'default_merchant').find(c=>c.customerCode===order.customerCode);if(customer){text(line(paperChars)+'\n');center(command,text,'MEMBERSHIP CUSTOMER');center(command,text,'Scan QR untuk cek kunjungan');command(0x1b,0x61,1);append(await makeQrRaster(buildMembershipScanUrl(customer),qrWidth));text('\n');append(await makeBarcodeRaster(customer.customerCode,barcodeWidth));text('\n');command(0x1b,0x61,0);center(command,text,`${safe(customer.customerCode)} - ${customer.visitCount}/10 KUNJUNGAN`);}}catch(e){console.warn('YUPOS membership QR/barcode skipped:',e);}}
  text(line(paperChars)+'\n');
  center(command,text,safe(settings.footer||'Terima kasih'));
  text('\n\n');
  command(0x1b,0x45,1); center(command,text,'Powered by YUPOS'); command(0x1b,0x45,0);
  command(0x1b,0x32); text('\n\n'); command(0x1d,0x56,0x00);
  return new Uint8Array(bytes);
}
