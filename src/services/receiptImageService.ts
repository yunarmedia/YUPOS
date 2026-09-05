import { Order, StoreSettings, Customer } from '../types';
import { loadCustomers } from './customerService';
import { buildMembershipScanUrl } from './membershipService';
import { drawCode128ToCanvas } from './barcodeService';
import { fetchExternalOrLocalQrDataUrl, fetchImageAsDataUrl, getExternalBarcodeUrl } from './codeGeneratorService';

function formatRp(num: number): string {
  return 'Rp ' + (num || 0).toLocaleString('id-ID');
}

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function drawMembershipQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size = 300): Promise<number> {
  const qrDataUrl = await fetchExternalOrLocalQrDataUrl(value, Math.max(600, size * 2));
  const image = await loadImage(qrDataUrl);
  const qrSize = Math.min(size, maxWidth);
  const startX = x + (maxWidth - qrSize) / 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(startX, y, qrSize, qrSize);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, startX, y, qrSize, qrSize);
  return y + qrSize;
}

async function drawMembershipBarcode(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number): Promise<number> {
  const barcodeWidth = Math.min(660, maxWidth * 0.86);
  const barcodeHeight = 110;
  const startX = x + (maxWidth - barcodeWidth) / 2;
  try {
    const dataUrl = await fetchImageAsDataUrl(getExternalBarcodeUrl(value, 900, 240));
    const image = await loadImage(dataUrl);
    ctx.fillStyle = '#fff';
    ctx.fillRect(startX, y, barcodeWidth, barcodeHeight);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, startX, y, barcodeWidth, barcodeHeight);
  } catch {
    drawCode128ToCanvas(ctx, value, startX, y, barcodeWidth, barcodeHeight);
  }
  return y + barcodeHeight;
}

export async function buildReceiptImage(order: Order, settings: StoreSettings): Promise<File> {
  const width = 800;
  const padding = 42;
  const contentWidth = width - padding * 2;
  const isBarbershop = settings.businessType === 'barbershop';
  let memberCustomer: Customer | null = null;
  if (isBarbershop && order.customerIsMember && order.customerCode) {
    try {
      memberCustomer = loadCustomers(order.merchantId || 'default_merchant').find((customer) => customer.customerCode === order.customerCode) || null;
    } catch { memberCustomer = null; }
  }

  const lineCount = order.items.reduce((sum, item) => sum + Math.max(1, Math.ceil(String(item.name || '').length / 24)), 0);
  const estimatedHeight = 700 + order.items.length * 98 + lineCount * 28 + (memberCustomer ? 560 : 0) + Math.ceil((settings.footer || '').length / 60) * 28;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1000, estimatedHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pembuatan gambar struk.');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = 38;

  if (settings.logoBase64) {
    try {
      const logo = await loadImage(settings.logoBase64);
      const maxW = 180; const maxH = 90;
      const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
      const w = logo.width * scale; const h = logo.height * scale;
      ctx.drawImage(logo, (width - w) / 2, y, w, h); y += h + 20;
    } catch { /* receipt remains valid without logo */ }
  }

  const center = (text: string, font: string, gap = 32) => { ctx.font = font; ctx.textAlign = 'center'; ctx.fillText(text, width / 2, y); y += gap; ctx.textAlign = 'left'; };
  center(settings.storeName || 'YUPOS', '900 30px system-ui', 44);
  if (settings.storeAddress) for (const line of wrapText(ctx, settings.storeAddress, contentWidth)) center(line, '500 18px system-ui', 29);
  if (settings.storePhone) center(`Telp: ${settings.storePhone}`, '500 18px system-ui', 31);
  drawDashedLine(ctx, padding, y + 8, contentWidth); y += 34;

  ctx.font = '600 18px system-ui';
  ctx.fillText(`${order.date} ${order.time}`, padding, y);
  ctx.textAlign = 'right'; ctx.fillText(`ID: ${order.id}`, width - padding, y); ctx.textAlign = 'left'; y += 34;
  ctx.fillText(`Kasir: ${order.cashierName || 'Kasir'} (S${order.shift})`, padding, y); y += 34;
  ctx.font = '800 20px system-ui'; ctx.fillText(`Pelanggan: ${order.customer || '-'}`, padding, y); y += 38;
  drawDashedLine(ctx, padding, y, contentWidth); y += 30;

  ctx.font = '700 20px system-ui';
  for (const item of order.items) {
    const itemLines = wrapText(ctx, `${item.name}${item.assignedTo ? ` [${item.assignedTo}]` : ''}`, contentWidth * 0.63);
    for (const line of itemLines) { ctx.fillText(line, padding, y); y += 28; }
    ctx.textAlign = 'right'; ctx.fillText(formatRp(item.price * item.qty), width - padding, y - 28); ctx.textAlign = 'left';
    ctx.font = '500 17px system-ui'; ctx.fillStyle = '#4b5563';
    ctx.fillText(`${item.qty} x ${formatRp(item.price)}`, padding + 12, y); y += 29;
    if (item.note) { for (const line of wrapText(ctx, `* ${item.note}`, contentWidth - 24)) { ctx.fillText(line, padding + 12, y); y += 27; } }
    y += 12;
    ctx.font = '700 20px system-ui'; ctx.fillStyle = '#111827';
  }

  drawDashedLine(ctx, padding, y, contentWidth); y += 30;
  ctx.font = '600 19px system-ui';
  if (order.discount > 0 || (order.ppn && order.ppn > 0)) { drawRow(ctx, 'Subtotal', formatRp(order.subtotal || order.total), padding, width - padding, y); y += 32; }
  if (order.discount > 0) { drawRow(ctx, 'Diskon', `- ${formatRp(order.discount)}`, padding, width - padding, y); y += 32; }
  if (order.ppn && order.ppn > 0) { drawRow(ctx, `PPN (${order.ppnRate || 11}%)`, `+ ${formatRp(order.ppn)}`, padding, width - padding, y); y += 32; }
  ctx.font = '900 25px system-ui'; drawRow(ctx, 'TOTAL', formatRp(order.total), padding, width - padding, y); y += 44;
  ctx.font = '700 19px system-ui'; drawRow(ctx, 'Metode Bayar', String(order.payment || '-').toUpperCase(), padding, width - padding, y); y += 34;

  if (memberCustomer) {
    drawDashedLine(ctx, padding, y, contentWidth); y += 30;
    center('MEMBERSHIP CUSTOMER', '900 20px system-ui', 30);
    center('Scan QR untuk cek kunjungan & reward membership', '500 15px system-ui', 30);
    const scanUrl = buildMembershipScanUrl(memberCustomer);
    y = await drawMembershipQr(ctx, scanUrl, padding, y, contentWidth, 280) + 18;
    y = await drawMembershipBarcode(ctx, memberCustomer.customerCode, padding, y, contentWidth) + 14;
    center(`${memberCustomer.customerCode} • ${memberCustomer.visitCount}/10 KUNJUNGAN`, '800 16px monospace', 30);
  }

  if (settings.footer) {
    drawDashedLine(ctx, padding, y, contentWidth); y += 30;
    ctx.font = '500 16px system-ui';
    for (const line of wrapText(ctx, settings.footer, contentWidth)) center(line, '500 16px system-ui', 28);
  }
  y += 32;

  const output = document.createElement('canvas');
  output.width = width;
  output.height = Math.min(Math.max(y, 320), canvas.height);
  output.getContext('2d')?.drawImage(canvas, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png', 0.96));
  if (!blob) throw new Error('Gagal membuat gambar struk.');
  return new File([blob], `YUPOS-Struk-${order.id}.png`, { type: 'image/png' });
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.stroke(); ctx.restore();
}

function drawRow(ctx: CanvasRenderingContext2D, left: string, right: string, x: number, rightX: number, y: number): void {
  ctx.textAlign = 'left'; ctx.fillText(left, x, y); ctx.textAlign = 'right'; ctx.fillText(right, rightX, y); ctx.textAlign = 'left';
}

export async function shareReceiptImage(order: Order, settings: StoreSettings): Promise<'shared' | 'fallback' | 'cancelled'> {
  const phone = normalizePhone(order.customerPhone || '');
  if (!phone) throw new Error('Nomor WhatsApp customer belum tersedia pada transaksi ini.');
  const file = await buildReceiptImage(order, settings);
  const message = `Bukti transaksi ${settings.storeName || 'YUPOS'} #${order.id} untuk ${order.customer || 'Customer'}. Total ${formatRp(order.total)}. Nomor tujuan: +${phone}.`;
  const shareData: ShareData = { title: `Bukti Transaksi #${order.id}`, text: message, files: [file] };
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share(shareData); return 'shared'; } catch (error) { if ((error as DOMException)?.name === 'AbortError') return 'cancelled'; throw error; }
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  return 'fallback';
}
