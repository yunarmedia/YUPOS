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
  return {
    app: 'YUPOS', version: 1, code: normalizeText(customer.customerCode), name: normalizeText(customer.name),
    phone: normalizeText(customer.phone || ''), visits: customer.visitCount || 0, memberSince: customer.memberSince,
    totalSpent: customer.totalSpent || 0, lastVisit: normalizeText(customer.lastVisit || '-'), reward: getMembershipReward(customer),
    visitDetails: deriveVisitDetails(customer),
  };
}

export function buildMembershipQrSnapshot(customer: Customer): Omit<MembershipSnapshot, 'visitDetails'> {
  return {
    app: 'YUPOS', version: 1, code: normalizeText(customer.customerCode), name: normalizeText(customer.name),
    phone: normalizeText(customer.phone || ''), visits: customer.visitCount || 0, memberSince: customer.memberSince,
    totalSpent: customer.totalSpent || 0, lastVisit: normalizeText(customer.lastVisit || '-'), reward: getMembershipReward(customer),
  };
}

export function buildMembershipScanUrl(customer: Customer): string {
  const payload = toBase64Url(JSON.stringify(buildMembershipQrSnapshot(customer)));
  const url = new URL('./member.html', window.location.href);
  url.searchParams.set('d', payload);
  return url.toString();
}
