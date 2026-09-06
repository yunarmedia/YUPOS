import { Customer, MembershipVisit } from '../types';
import { loadMerchantOrders } from './storageService';

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

function formatCreatedAt(createdAt?: number): string | undefined {
  if (!createdAt) return undefined;
  try {
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(createdAt));
  } catch {
    return undefined;
  }
}

export interface MembershipSnapshot {
  app: 'YUPOS';
  version: 1;
  code: string;
  name: string;
  phone: string;
  visits: number;
  memberSince?: string;
  totalSpent: number;
  lastVisit: string;
  reward: 'none' | 'discount50' | 'freeHaircut';
  visitDetails?: MembershipVisit[];
}

export function getMembershipReward(customer: Customer): MembershipSnapshot['reward'] {
  if ((customer.visitCount || 0) >= 10) return 'freeHaircut';
  if ((customer.visitCount || 0) >= 5) return 'discount50';
  return 'none';
}

function deriveVisitDetails(customer: Customer): MembershipVisit[] {
  const stored = customer.membershipVisits || [];
  if (stored.length) return stored.slice(-10);
  try {
    const merchantId = customer.merchantId || JSON.parse(localStorage.getItem('yupos_merchant_session') || '{}')?.uid || 'default_merchant';
    const settingsRaw = localStorage.getItem(`yupos_${merchantId}_settings`);
    const businessType = settingsRaw ? JSON.parse(settingsRaw)?.businessType || 'barbershop' : 'barbershop';
    const orders = loadMerchantOrders(merchantId, businessType);
    return orders.filter((order) => order.status === 'selesai' && order.customerCode === customer.customerCode).slice(-(customer.visitCount || 0)).map((order) => ({
      id: `ORDER-${order.id}`, date: order.date, time: order.time, amount: order.total || 0, orderId: order.id,
      services: order.items.filter((item) => item.type === 'service').map((item) => item.name),
      staff: Array.from(new Set(order.items.map((item) => item.assignedTo).filter(Boolean) as string[])),
    }));
  } catch { return []; }
}

export function buildMembershipSnapshot(customer: Customer): MembershipSnapshot {
  const visits = deriveVisitDetails(customer);
  const latest = visits[visits.length - 1];
  return {
    app: 'YUPOS', version: 1, code: normalizeText(customer.customerCode), name: normalizeText(customer.name),
    phone: normalizeText(customer.phone || ''), visits: customer.visitCount || 0,
    memberSince: normalizeText(customer.memberSince || formatCreatedAt(customer.createdAt) || '-'),
    totalSpent: customer.totalSpent || 0,
    lastVisit: normalizeText(customer.lastVisit || (latest ? `${latest.date} ${latest.time}`.trim() : '-')),
    reward: getMembershipReward(customer), visitDetails: visits,
  };
}

/**
 * Compact payload used inside the printed QR. It includes the member identity,
 * current reward state, creation date, latest visit and latest purchased/
 * booked items while remaining small enough for reliable thermal QR printing.
 */
export function buildMembershipQrSnapshot(customer: Customer) {
  const visits = deriveVisitDetails(customer);
  const latest = visits[visits.length - 1];
  const latestOrderItems = latest
    ? (() => {
        try {
          const merchantId = customer.merchantId || JSON.parse(localStorage.getItem('yupos_merchant_session') || '{}')?.uid || 'default_merchant';
          const settingsRaw = localStorage.getItem(`yupos_${merchantId}_settings`);
          const businessType = settingsRaw ? JSON.parse(settingsRaw)?.businessType || 'barbershop' : 'barbershop';
          const orders = loadMerchantOrders(merchantId, businessType);
          const order = orders.find((candidate) => candidate.id === latest.orderId);
          return order?.items.map((item) => `${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}`).slice(0, 4) || latest.services.slice(0, 4);
        } catch { return latest.services.slice(0, 4); }
      })()
    : [];

  return {
    a: 'Y',
    v: 3,
    c: normalizeText(customer.customerCode),
    n: normalizeText(customer.name),
    i: customer.visitCount || 0,
    r: getMembershipReward(customer),
    ms: normalizeText(customer.memberSince || formatCreatedAt(customer.createdAt) || '-'),
    lv: normalizeText(customer.lastVisit || (latest ? `${latest.date} ${latest.time}`.trim() : '-')),
    li: latestOrderItems.map(normalizeText).join(' | ').slice(0, 180),
  } as const;
}

export function buildMembershipScanUrl(customer: Customer): string {
  const payload = toBase64Url(JSON.stringify(buildMembershipQrSnapshot(customer)));
  const url = new URL('./member.html', window.location.href);
  url.searchParams.set('d', payload);
  return url.toString();
}
