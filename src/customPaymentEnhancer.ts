import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config/firebase';

const METHODS_SUFFIX = '_custom_payment_methods';
const PENDING_KEY = 'yupos_pending_custom_payment';
const BREAKDOWN_ID = 'yupos-custom-payment-revenue';
const REWARD_BUTTON_ATTR = 'data-yupos-membership-reward';

interface PendingPayment { method: string; startedAt: number; expiresAt: number; }
type RewardType = 'discount50' | 'freeHaircut';
const safe = <T,>(raw: string | null, fallback: T): T => { try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const getSession = () => safe<any>(localStorage.getItem('yupos_merchant_session'), null);
const getUid = () => String(getSession()?.uid || '').trim();
const getSettings = () => { const uid = getUid(); return uid ? safe<any>(localStorage.getItem(`yupos_${uid}_settings`), {}) : {}; };
const getMethods = () => { const uid = getUid(); if (!uid) return []; const settings = getSettings(); const local = safe<string[]>(localStorage.getItem(`yupos_${uid}${METHODS_SUFFIX}`), settings.customPaymentMethods || []); return Array.from(new Set((local || []).map((v) => String(v).trim().replace(/\s+/g, ' ')).filter(Boolean))).slice(0, 30); };
const getCustomers = () => { const uid = getUid(); return uid ? safe<any[]>(localStorage.getItem(`yupos_${uid}_customers`), []) : []; };
const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
const ordersKey = (uid: string, businessType: string) => `yupos_${uid}_${businessType}_orders`;

const fireInput = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const findDiscountInput = (): HTMLInputElement | null => {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
  return inputs.find((input) => {
    const text = `${input.getAttribute('placeholder') || ''} ${input.getAttribute('aria-label') || ''} ${input.parentElement?.parentElement?.innerText || ''}`.toLowerCase();
    return (input.type === 'number' || input.inputMode === 'numeric') && text.includes('diskon');
  }) || null;
};

const setDiscountType = (type: '%' | 'Rp') => {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
  const select = selects.find((s) => `${s.parentElement?.innerText || ''}`.toLowerCase().includes('diskon'));
  if (!select) return;
  const option = Array.from(select.options).find((o) => o.value === type || o.textContent?.trim() === type);
  if (!option) return;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const getSelectedMember = () => {
  const members = getCustomers().filter((c) => c?.isMember && Number(c?.visitCount || 0) >= 5);
  if (!members.length) return null;
  const body = document.body.innerText;
  return members
    .filter((c) => body.includes(`[${String(c.customerCode)}]`))
    .sort((a, b) => Number(b.visitCount || 0) - Number(a.visitCount || 0))[0] || null;
};

const getReward = (customer: any): { type: RewardType; label: string; visits: number } | null => {
  const visits = Number(customer?.visitCount || 0);
  if (visits >= 10) return { type: 'freeHaircut', label: 'Cukur Gratis', visits };
  if (visits >= 5) return { type: 'discount50', label: 'Diskon 50%', visits };
  return null;
};

const applyMembershipReward = (customer: any, reward: { type: RewardType; label: string; visits: number }) => {
  const uid = getUid(); if (!uid) return;
  const discountInput = findDiscountInput();
  if (!discountInput) {
    window.alert('Kolom Diskon transaksi tidak ditemukan. Buka area pembayaran lalu coba lagi.');
    return;
  }
  const businessType = String(getSettings().businessType || 'barbershop');
  const orders = safe<any[]>(localStorage.getItem(ordersKey(uid, businessType)), []);
  // Reward intent is consumed by recordCustomerVisit only after the transaction is completed.
  localStorage.setItem(`yupos_${uid}_pending_membership_reward`, JSON.stringify({ customerCode: customer.customerCode, reward: reward.type, createdAt: Date.now() }));
  if (reward.type === 'discount50') {
    setDiscountType('%');
    fireInput(discountInput, '50');
  } else {
    // Free haircut is represented as a 100% transaction discount so it is immediately visible in the discount field.
    setDiscountType('%');
    fireInput(discountInput, '100');
  }
  const button = document.querySelector<HTMLButtonElement>(`[${REWARD_BUTTON_ATTR}]`);
  if (button) { button.disabled = true; button.textContent = `✓ ${reward.label} diterapkan`; }
  void orders;
};

const injectMembershipRewardButton = () => {
  const cashButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'CASH (TUNAI)');
  if (!cashButton) return;
  const customer = getSelectedMember();
  const reward = customer ? getReward(customer) : null;
  document.querySelectorAll<HTMLElement>(`[${REWARD_BUTTON_ATTR}]`).forEach((el) => el.remove());
  if (!customer || !reward) return;

  const codeNode = Array.from(document.querySelectorAll<HTMLElement>('span,div')).find((el) => el.textContent?.trim() === `[${customer.customerCode}]`);
  const anchor = codeNode?.parentElement?.parentElement || cashButton.parentElement;
  if (!anchor || anchor.querySelector(`[${REWARD_BUTTON_ATTR}]`)) return;
  const button = document.createElement('button');
  button.type = 'button'; button.setAttribute(REWARD_BUTTON_ATTR, 'true');
  button.textContent = `🎁 Claim Reward • ${reward.label}`;
  button.style.cssText = 'width:100%;margin-top:8px;padding:9px 10px;border:1px solid #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e;font-size:11px;font-weight:900;cursor:pointer;';
  button.addEventListener('click', () => applyMembershipReward(customer, reward));
  anchor.appendChild(button);
};

const finalizePendingPayment = async () => {
  const raw = sessionStorage.getItem(PENDING_KEY); if (!raw) return;
  const pending = safe<PendingPayment | null>(raw, null);
  if (!pending || Date.now() > pending.expiresAt) { sessionStorage.removeItem(PENDING_KEY); return; }
  const uid = getUid(); if (!uid) return;
  const businessType = String(getSettings().businessType || 'barbershop');
  const key = ordersKey(uid, businessType);
  const orders = safe<any[]>(localStorage.getItem(key), []);
  const latest = orders.filter((o) => o?.status === 'selesai' && Number(o?.timestamp || 0) >= pending.startedAt).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  if (!latest) return;
  if (latest.payment !== pending.method) {
    latest.payment = pending.method; latest.merchantId = uid; latest.businessType = businessType;
    localStorage.setItem(key, JSON.stringify(orders));
    try { await setDoc(doc(db, 'yupos_transactions', `${uid}_${businessType}_orders`), { list: orders, merchantId: uid, businessType, updatedAt: Date.now() }, { merge: true }); } catch (error) { console.warn('Custom payment transaction sync warning:', error); }
  }
  sessionStorage.removeItem(PENDING_KEY);
  window.setTimeout(() => window.location.reload(), 100);
};

const triggerCustomPayment = (method: string) => {
  const cashButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'CASH (TUNAI)');
  if (!cashButton || cashButton.disabled) return;
  const startedAt = Date.now();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ method, startedAt, expiresAt: startedAt + 8000 } satisfies PendingPayment));
  cashButton.click();
  window.setTimeout(() => void finalizePendingPayment(), 350);
};

const injectPaymentButtons = () => {
  const uid = getUid(); const methods = getMethods(); if (!uid || !methods.length) return;
  const cash = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'CASH (TUNAI)');
  if (!cash?.parentElement) return;
  const parent = cash.parentElement; const marker = 'data-yupos-custom-payment-buttons';
  let wrapper = parent.querySelector<HTMLElement>(`[${marker}]`);
  if (!wrapper) { wrapper = document.createElement('div'); wrapper.setAttribute(marker, 'true'); wrapper.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;'; parent.appendChild(wrapper); }
  const signature = methods.join('|'); if (wrapper.dataset.signature === signature) return;
  wrapper.dataset.signature = signature;
  wrapper.innerHTML = methods.map((m) => `<button type="button" data-yupos-custom-payment="${encodeURIComponent(m)}" style="padding:10px;border:1px solid #cbd5e1;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:900;cursor:pointer;">${escapeHtml(m)}</button>`).join('');
  wrapper.querySelectorAll<HTMLButtonElement>('[data-yupos-custom-payment]').forEach((button) => button.addEventListener('click', () => triggerCustomPayment(decodeURIComponent(button.dataset.yuposCustomPayment || ''))));
};

const renderRevenueBreakdown = () => {
  const uid = getUid(); const body = document.body.innerText; const visible = body.includes('Total Omzet') || body.includes('Total Omzet Hari Ini');
  const existing = document.getElementById(BREAKDOWN_ID);
  if (!uid || !visible) { existing?.remove(); return; }
  const methods = getMethods(); if (!methods.length) { existing?.remove(); return; }
  const businessType = String(getSettings().businessType || 'barbershop'); const today = new Date().toISOString().split('T')[0];
  const orders = safe<any[]>(localStorage.getItem(ordersKey(uid, businessType)), []);
  const totals = methods.map((method) => ({ method, total: orders.filter((o) => o?.status === 'selesai' && o?.date === today && o?.payment === method).reduce((sum, o) => sum + Number(o?.total || 0), 0) }));
  const card = existing || document.createElement('div'); card.id = BREAKDOWN_ID;
  if (!existing) { const anchor = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,div')).find((el) => el.textContent?.trim() === 'Total Omzet')?.parentElement?.parentElement || document.querySelector('main'); anchor?.appendChild(card); }
  card.innerHTML = `<div style="font-size:12px;font-weight:900;margin-bottom:4px">💳 Omzet per Metode Custom</div>${totals.map((x) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.18);font-size:11px"><span>${escapeHtml(x.method)}</span><strong>${formatRp(x.total)}</strong></div>`).join('')}`;
  card.style.cssText = 'margin-top:12px;background:#0f172a;color:#fff;border-radius:16px;padding:13px;';
};

const boot = () => {
  let scheduled = false;
  const refresh = () => { if (scheduled) return; scheduled = true; window.setTimeout(() => { scheduled = false; injectPaymentButtons(); injectMembershipRewardButton(); renderRevenueBreakdown(); }, 60); };
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  window.setInterval(() => { injectPaymentButtons(); injectMembershipRewardButton(); renderRevenueBreakdown(); void finalizePendingPayment(); }, 1200);
  injectPaymentButtons(); injectMembershipRewardButton(); renderRevenueBreakdown(); void finalizePendingPayment();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
