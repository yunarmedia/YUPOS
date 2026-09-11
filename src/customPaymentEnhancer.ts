import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config/firebase';

const METHODS_KEY_SUFFIX = '_custom_payment_methods';
const PENDING_KEY = 'yupos_pending_custom_payment';
const MANAGER_ID = 'yupos-custom-payment-manager';
const REVENUE_ID = 'yupos-custom-payment-revenue';

interface PendingPayment {
  method: string;
  startedAt: number;
  expiresAt: number;
}

const safeJson = <T,>(value: string | null, fallback: T): T => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getSession = (): { uid: string; email?: string | null } | null => {
  const session = safeJson<any>(localStorage.getItem('yupos_merchant_session'), null);
  const uid = String(session?.uid || '').trim();
  return uid ? { uid, email: session?.email } : null;
};

const getSettings = (uid: string): any => safeJson(localStorage.getItem(`yupos_${uid}_settings`), {});
const getBusinessType = (uid: string): string => String(getSettings(uid)?.businessType || 'barbershop');
const getMethodsKey = (uid: string) => `yupos_${uid}${METHODS_KEY_SUFFIX}`;
const normalizeMethod = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 40);

const loadMethods = (uid: string): string[] => {
  const stored = safeJson<string[]>(localStorage.getItem(getMethodsKey(uid)), []);
  if (Array.isArray(stored) && stored.length) return Array.from(new Set(stored.map(normalizeMethod).filter(Boolean)));
  const settings = getSettings(uid);
  const fromSettings = Array.isArray(settings?.customPaymentMethods) ? settings.customPaymentMethods : [];
  return Array.from(new Set(fromSettings.map(normalizeMethod).filter(Boolean)));
};

const persistMethods = async (uid: string, methods: string[]) => {
  const normalized = Array.from(new Set(methods.map(normalizeMethod).filter(Boolean))).slice(0, 30);
  localStorage.setItem(getMethodsKey(uid), JSON.stringify(normalized));
  const settings = getSettings(uid);
  settings.customPaymentMethods = normalized;
  localStorage.setItem(`yupos_${uid}_settings`, JSON.stringify(settings));

  try {
    await setDoc(
      doc(db, 'yupos_config', uid, 'settings', 'data'),
      { customPaymentMethods: normalized, merchantId: uid, updatedAt: Date.now() },
      { merge: true },
    );
  } catch (error) {
    console.warn('YUPOS custom payment config sync warning:', error);
  }
};

const getOrdersKey = (uid: string, businessType: string) => `yupos_${uid}_${businessType}_orders`;
const loadOrders = (uid: string, businessType: string): any[] => {
  const orders = safeJson<any[]>(localStorage.getItem(getOrdersKey(uid, businessType)), []);
  return Array.isArray(orders) ? orders : [];
};

const syncPatchedOrder = async (uid: string, businessType: string, patchedOrder: any) => {
  const ref = doc(db, 'yupos_transactions', uid, businessType, 'orders');
  const snapshot = await getDoc(ref);
  const remote = snapshot.exists() && Array.isArray(snapshot.data()?.list) ? [...snapshot.data().list] : [];
  const index = remote.findIndex((order: any) => String(order?.id || '') === String(patchedOrder?.id || ''));
  if (index >= 0) remote[index] = { ...remote[index], ...patchedOrder, merchantId: uid, businessType };
  else remote.push({ ...patchedOrder, merchantId: uid, businessType });
  await setDoc(ref, { list: remote, merchantId: uid, businessType, updatedAt: Date.now() }, { merge: true });
};

const finalizePendingPayment = async () => {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return;
  const pending = safeJson<PendingPayment | null>(raw, null);
  if (!pending) {
    sessionStorage.removeItem(PENDING_KEY);
    return;
  }
  if (Date.now() > pending.expiresAt) {
    sessionStorage.removeItem(PENDING_KEY);
    return;
  }

  const session = getSession();
  if (!session) return;
  const businessType = getBusinessType(session.uid);
  const orders = loadOrders(session.uid, businessType);
  const latest = orders
    .filter((order) => order?.status === 'selesai' && Number(order?.timestamp || 0) >= pending.startedAt)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
  if (!latest) return;

  if (latest.payment !== pending.method) {
    latest.payment = pending.method;
    latest.merchantId = session.uid;
    latest.businessType = businessType;
    localStorage.setItem(getOrdersKey(session.uid, businessType), JSON.stringify(orders));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await syncPatchedOrder(session.uid, businessType, latest);
        break;
      } catch (error) {
        console.warn(`YUPOS custom payment order sync attempt ${attempt + 1} failed:`, error);
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
    }
  }

  sessionStorage.removeItem(PENDING_KEY);
  window.setTimeout(() => window.location.reload(), 120);
};

const injectStyles = () => {
  if (document.getElementById('yupos-custom-payment-styles')) return;
  const style = document.createElement('style');
  style.id = 'yupos-custom-payment-styles';
  style.textContent = `
    #${MANAGER_ID}{position:fixed;right:16px;bottom:16px;z-index:9999;font-family:inherit}
    #${MANAGER_ID} .yp-pay-launcher{border:0;border-radius:14px;background:#0f172a;color:#fff;padding:10px 14px;font-size:12px;font-weight:900;box-shadow:0 10px 30px rgba(15,23,42,.22);cursor:pointer}
    #${MANAGER_ID} .yp-pay-modal{position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;padding:16px}
    #${MANAGER_ID} .yp-pay-card{width:min(440px,100%);max-height:min(680px,90vh);overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 30px 80px rgba(15,23,42,.3)}
    #${MANAGER_ID} .yp-pay-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
    #${MANAGER_ID} .yp-pay-title{font-size:16px;font-weight:900;color:#0f172a}
    #${MANAGER_ID} .yp-pay-sub{font-size:11px;color:#64748b;margin-top:2px}
    #${MANAGER_ID} .yp-pay-close{border:0;background:#f1f5f9;color:#475569;border-radius:10px;width:34px;height:34px;cursor:pointer;font-weight:900}
    #${MANAGER_ID} .yp-pay-row{display:flex;gap:8px;margin-bottom:12px}
    #${MANAGER_ID} .yp-pay-input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:11px;padding:10px 12px;font-size:12px;font-weight:700;outline:none}
    #${MANAGER_ID} .yp-pay-add{border:0;background:#2563eb;color:#fff;border-radius:11px;padding:10px 14px;font-size:12px;font-weight:900;cursor:pointer}
    #${MANAGER_ID} .yp-pay-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px}
    #${MANAGER_ID} .yp-pay-name{font-size:12px;font-weight:800;color:#0f172a}
    #${MANAGER_ID} .yp-pay-delete{border:0;background:#fee2e2;color:#b91c1c;border-radius:9px;padding:6px 9px;font-size:10px;font-weight:900;cursor:pointer}
    #${MANAGER_ID} .yp-pay-presets{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px}
    #${MANAGER_ID} .yp-pay-preset{border:1px dashed #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900;cursor:pointer}
    #${REVENUE_ID}{position:fixed;right:16px;bottom:16px;z-index:9997;width:min(330px,calc(100vw - 32px));background:#0f172a;color:#fff;border-radius:18px;padding:14px;box-shadow:0 18px 50px rgba(15,23,42,.28)}
    #${REVENUE_ID} .yp-rev-title{font-size:12px;font-weight:900}
    #${REVENUE_ID} .yp-rev-sub{font-size:10px;color:#94a3b8;margin:2px 0 10px}
    #${REVENUE_ID} .yp-rev-line{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.16);font-size:11px}
    #${REVENUE_ID} .yp-rev-line:last-child{border-bottom:0}
    #${REVENUE_ID} .yp-rev-value{font-weight:900}
  `;
  document.head.appendChild(style);
};

const formatRp = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const renderManager = (force = false) => {
  const session = getSession();
  const root = document.getElementById(MANAGER_ID);
  if (!session) {
    root?.remove();
    return;
  }
  if (root && !force) return;
  injectStyles();
  const methods = loadMethods(session.uid);
  const container = root || document.createElement('div');
  container.id = MANAGER_ID;
  if (!root) document.body.appendChild(container);

  container.innerHTML = `
    <button class="yp-pay-launcher" type="button">💳 Metode Pembayaran</button>
    <div class="yp-pay-modal" style="display:none">
      <div class="yp-pay-card">
        <div class="yp-pay-head"><div><div class="yp-pay-title">Metode Pembayaran Custom</div><div class="yp-pay-sub">Tambahkan metode seperti Ojek Online, Delivery, COD, atau lainnya.</div></div><button class="yp-pay-close" type="button">×</button></div>
        <div class="yp-pay-row"><input class="yp-pay-input" maxlength="40" placeholder="Contoh: Ojek Online" /><button class="yp-pay-add" type="button">+ Tambah</button></div>
        <div class="yp-pay-presets"><button class="yp-pay-preset" type="button" data-method="Ojek Online">+ Ojek Online</button><button class="yp-pay-preset" type="button" data-method="Delivery">+ Delivery</button><button class="yp-pay-preset" type="button" data-method="COD">+ COD</button><button class="yp-pay-preset" type="button" data-method="Kasbon">+ Kasbon</button></div>
        <div class="yp-pay-list">${methods.length ? methods.map((method) => `<div class="yp-pay-item"><span class="yp-pay-name">${method.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span><button class="yp-pay-delete" type="button" data-delete="${encodeURIComponent(method)}">Hapus</button></div>`).join('') : '<div style="font-size:11px;color:#94a3b8;padding:8px 0">Belum ada metode custom.</div>'}</div>
      </div>
    </div>`;

  const launcher = container.querySelector('.yp-pay-launcher') as HTMLButtonElement | null;
  const modal = container.querySelector('.yp-pay-modal') as HTMLDivElement | null;
  const close = container.querySelector('.yp-pay-close') as HTMLButtonElement | null;
  const input = container.querySelector('.yp-pay-input') as HTMLInputElement | null;
  const add = container.querySelector('.yp-pay-add') as HTMLButtonElement | null;
  launcher?.addEventListener('click', () => { if (modal) modal.style.display = 'flex'; });
  close?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  modal?.addEventListener('click', (event) => { if (event.target === modal) modal.style.display = 'none'; });

  const addMethod = async (value: string) => {
    const method = normalizeMethod(value);
    if (!method || loadMethods(session.uid).includes(method)) return;
    await persistMethods(session.uid, [...loadMethods(session.uid), method]);
    renderManager(true);
  };
  add?.addEventListener('click', () => { void addMethod(input?.value || ''); });
  input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') void addMethod(input.value); });
  container.querySelectorAll<HTMLElement>('[data-method]').forEach((button) => button.addEventListener('click', () => void addMethod(button.dataset.method || '')));
  container.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
    const method = decodeURIComponent(button.dataset.delete || '');
    await persistMethods(session.uid, loadMethods(session.uid).filter((item) => item !== method));
    renderManager(true);
  }));
};

const triggerCustomPayment = (method: string) => {
  const session = getSession();
  if (!session) return;
  const cashButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'CASH (TUNAI)');
  if (!cashButton || cashButton.disabled) return;
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ method, startedAt: Date.now(), expiresAt: Date.now() + 7000 } satisfies PendingPayment));
  cashButton.click();
  window.setTimeout(() => void finalizePendingPayment(), 300);
};

const injectPaymentButtons = () => {
  const session = getSession();
  if (!session) return;
  const methods = loadMethods(session.uid);
  if (!methods.length) return;
  const cashButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'CASH (TUNAI)');
  if (!cashButton?.parentElement) return;
  const parent = cashButton.parentElement;
  const marker = 'data-yupos-custom-payment-buttons';
  let wrapper = parent.querySelector<HTMLElement>(`[${marker}]`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.setAttribute(marker, 'true');
    wrapper.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;';
    parent.appendChild(wrapper);
  }
  const signature = methods.join('|');
  if (wrapper.dataset.signature === signature) return;
  wrapper.dataset.signature = signature;
  wrapper.innerHTML = methods.map((method) => `<button type="button" data-yupos-custom-payment="${encodeURIComponent(method)}" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:900;cursor:pointer;">${method.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`).join('');
  wrapper.querySelectorAll<HTMLButtonElement>('[data-yupos-custom-payment]').forEach((button) => button.addEventListener('click', () => triggerCustomPayment(decodeURIComponent(button.dataset.yuposCustomPayment || ''))));
};

const renderRevenueCustomBreakdown = () => {
  const session = getSession();
  const revenueVisible = document.body.innerText.includes('Total Omzet');
  const existing = document.getElementById(REVENUE_ID);
  if (!session || !revenueVisible) {
    existing?.remove();
    return;
  }
  const methods = loadMethods(session.uid);
  if (!methods.length) {
    existing?.remove();
    return;
  }
  const businessType = getBusinessType(session.uid);
  const today = new Date().toISOString().split('T')[0];
  const orders = loadOrders(session.uid, businessType);
  const totals = methods.map((method) => ({
    method,
    total: orders.filter((order) => order?.status === 'selesai' && order?.date === today && order?.payment === method).reduce((sum, order) => sum + Number(order?.total || 0), 0),
  }));
  const html = `<div class="yp-rev-title">💳 Omzet Metode Custom</div><div class="yp-rev-sub">Hari ini · berdasarkan metode pembayaran</div>${totals.map((item) => `<div class="yp-rev-line"><span>${item.method.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span><span class="yp-rev-value">${formatRp(item.total)}</span></div>`).join('')}`;
  const card = existing || document.createElement('div');
  card.id = REVENUE_ID;
  if (!existing) document.body.appendChild(card);
  if (card.dataset.html !== html) {
    card.dataset.html = html;
    card.innerHTML = html;
  }
};

const boot = () => {
  injectStyles();
  renderManager();
  void finalizePendingPayment();
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      renderManager();
      injectPaymentButtons();
      renderRevenueCustomBreakdown();
    }, 50);
  };
  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  window.setInterval(() => {
    renderManager();
    injectPaymentButtons();
    renderRevenueCustomBreakdown();
    void finalizePendingPayment();
  }, 1200);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
