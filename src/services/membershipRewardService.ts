import { Customer, MembershipReward, MembershipRewardType, StoreSettings } from '../types';

/** Legacy rewards are only a migration fallback for existing barbershop accounts. */
export const LEGACY_BARBERSHOP_REWARDS: MembershipReward[] = [
  { id: 'legacy-discount50', name: 'Diskon 50%', type: 'percentage', requiredVisits: 5, value: 50, description: 'Diskon 50% setelah 5 kunjungan.', active: true },
  { id: 'legacy-freeHaircut', name: 'Cukur Gratis', type: 'percentage', requiredVisits: 10, value: 100, description: 'Gratis setelah 10 kunjungan.', active: true },
];

export function getMembershipRewards(settings?: StoreSettings | null): MembershipReward[] {
  const configured = Array.isArray(settings?.membershipRewards) ? settings!.membershipRewards : [];
  if (configured.length) return configured.filter((reward) => reward && reward.active !== false && Number(reward.requiredVisits) > 0);
  if (settings?.businessType === 'barbershop') return LEGACY_BARBERSHOP_REWARDS;
  return [];
}

export function getEligibleMembershipRewards(customer: Customer, settings?: StoreSettings | null): MembershipReward[] {
  const visits = Number(customer?.visitCount || 0);
  return getMembershipRewards(settings)
    .filter((reward) => visits >= Number(reward.requiredVisits || 0))
    .sort((a, b) => Number(b.requiredVisits || 0) - Number(a.requiredVisits || 0));
}

export function getBestMembershipReward(customer: Customer, settings?: StoreSettings | null): MembershipReward | null {
  return getEligibleMembershipRewards(customer, settings)[0] || null;
}

export function formatMembershipReward(reward: MembershipReward): string {
  if (reward.type === 'percentage') return `${reward.name} (${Number(reward.value || 0)}%)`;
  if (reward.type === 'fixed') return `${reward.name} (Rp ${Math.max(0, Number(reward.value || 0)).toLocaleString('id-ID')})`;
  if (reward.type === 'freeItem') return `${reward.name}${reward.itemName ? ` • ${reward.itemName}` : ''}`;
  return reward.name;
}

export function calculateMembershipDiscount(reward: MembershipReward, subtotal: number, lineTotalForItem = 0): number {
  const base = Math.max(0, Number(reward.type === 'freeItem' ? lineTotalForItem : subtotal) || 0);
  if (reward.type === 'percentage') return Math.min(base, base * Math.max(0, Math.min(100, Number(reward.value || 0))) / 100);
  if (reward.type === 'fixed') return Math.min(base, Math.max(0, Number(reward.value || 0)));
  if (reward.type === 'freeItem') return Math.max(0, Math.min(base, lineTotalForItem));
  return 0;
}
