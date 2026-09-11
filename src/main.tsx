import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import App from './App.tsx';
import { AuthBootstrap } from './components/AuthBootstrap';
import { UpdateNotice } from './components/UpdateNotice';
import { auth } from './config/firebase';
import { hydrateMerchantDataFromFirebase } from './services/merchantCloudHydration';
import './customPaymentEnhancer';
import './index.css';
import './premium-ui.css';

function migrateLegacyAuthorityCredential(): void {
  try {
    const session = JSON.parse(localStorage.getItem('yupos_merchant_session') || 'null');
    const uid = String(session?.uid || '').trim();
    if (!uid) return;
    const key = `yupos_${uid}_settings`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings?.portalPins?.admin === '2024UDC') {
      settings.portalPins.admin = '';
      localStorage.setItem(key, JSON.stringify(settings));
      localStorage.setItem('yupos_settings', JSON.stringify(settings));
    }
  } catch {
    // Ignore malformed legacy settings; the authenticated merchant flow will recover defaults.
  }
}

migrateLegacyAuthorityCredential();

function readPortalPins(): Record<string, string> {
  try {
    const session = JSON.parse(localStorage.getItem('yupos_merchant_session') || 'null');
    const uid = String(session?.uid || '').trim();
    if (!uid) return {};
    const settings = JSON.parse(localStorage.getItem(`yupos_${uid}_settings`) || 'null');
    return settings?.portalPins || {};
  } catch {
    return {};
  }
}

function getSensitiveActionPin(button: HTMLButtonElement): { pin: string; title: string } | null {
  const text = (button.textContent || '').trim().toLowerCase();
  const title = (button.getAttribute('title') || '').toLowerCase();
  const body = document.body.innerText.toLowerCase();
  const pins = readPortalPins();
  const isHistory = body.includes('riwayat transaksi');
  const isInventory = body.includes('manajemen produk') || body.includes('produk & layanan');
  const isCustomer = body.includes('data pelanggan') || body.includes('data customer');
  const isExpense = body.includes('pengeluaran');
  const isEdit = title.includes('edit') || text.includes('edit') || Boolean(button.querySelector('svg.lucide-edit-3'));
  const isDelete = title.includes('hapus') || text.includes('hapus') || Boolean(button.querySelector('svg.lucide-trash-2'));
  const isCancel = title.includes('batalkan') || text.includes('batalkan') || Boolean(button.querySelector('svg.lucide-circle-x'));

  if (isHistory && isEdit) return pins.historyEditPin ? { pin: pins.historyEditPin, title: 'Otorisasi Edit Transaksi' } : null;
  if (isHistory && isDelete) return pins.historyDeletePin ? { pin: pins.historyDeletePin, title: 'Otorisasi Hapus Transaksi' } : null;
  if (isHistory && isCancel) return pins.historyCancelPin ? { pin: pins.historyCancelPin, title: 'Otorisasi Batalkan Transaksi' } : null;
  if (isInventory && isEdit) return pins.productEditPin ? { pin: pins.productEditPin, title: 'Otorisasi Edit Produk / Jasa' } : null;
  if (isInventory && isDelete) return pins.productDeletePin ? { pin: pins.productDeletePin, title: 'Otorisasi Hapus Produk / Jasa' } : null;
  if (isCustomer && isEdit) return pins.customerEditPin ? { pin: pins.customerEditPin, title: 'Otorisasi Edit Customer' } : null;
  if (isCustomer && isDelete) return pins.customerDeletePin ? { pin: pins.customerDeletePin, title: 'Otorisasi Hapus Customer' } : null;
  if (isExpense && isEdit) return pins.expenseEditPin ? { pin: pins.expenseEditPin, title: 'Otorisasi Edit Pengeluaran' } : null;
  if (isExpense && isDelete) return pins.expenseDeletePin ? { pin: pins.expenseDeletePin, title: 'Otorisasi Hapus Pengeluaran' } : null;
  return null;
}

function installYuposConfirmBridge() {
  let bypassNextConfirm = false;
  let activeButton: HTMLButtonElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let pendingPinAction: (() => void) | null = null;

  const close = () => { overlay?.remove(); overlay = null; activeButton = null; pendingPinAction = null; };
  const open = (message: string, button: HTMLButtonElement) => {
    close(); activeButton = button;
    overlay = document.createElement('div'); overlay.className = 'yupos-confirm-overlay';
    overlay.innerHTML = `<div class="yupos-confirm-card" role="dialog" aria-modal="true"><div class="yupos-confirm-icon"><span>!</span></div><div class="yupos-confirm-eyebrow">YUPOS • KONFIRMASI</div><h2 class="yupos-confirm-title">Konfirmasi Tindakan</h2><p class="yupos-confirm-message"></p><div class="yupos-confirm-actions"><button type="button" class="yupos-confirm-cancel">Batal</button><button type="button" class="yupos-confirm-danger">Hapus</button></div></div>`;
    const messageEl = overlay.querySelector('.yupos-confirm-message'); if (messageEl) messageEl.textContent = message;
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('.yupos-confirm-cancel')?.addEventListener('click', close);
    overlay.querySelector('.yupos-confirm-danger')?.addEventListener('click', () => { const target = activeButton; close(); if (!target) return; bypassNextConfirm = true; target.click(); window.setTimeout(() => { bypassNextConfirm = false; }, 0); });
    document.body.appendChild(overlay);
  };

  const openPin = (title: string, expectedPin: string, action: () => void) => {
    close(); pendingPinAction = action;
    overlay = document.createElement('div'); overlay.className = 'yupos-confirm-overlay';
    overlay.innerHTML = `<div class="yupos-confirm-card" role="dialog" aria-modal="true"><div class="yupos-confirm-icon"><span>🔐</span></div><div class="yupos-confirm-eyebrow">YUPOS • OTORITAS ADMIN</div><h2 class="yupos-confirm-title"></h2><p class="yupos-confirm-message">Masukkan PIN / Sandi untuk melanjutkan.</p><input class="yupos-authority-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="Masukkan PIN"><p class="yupos-authority-error" style="min-height:18px;color:#dc2626;font-size:11px;font-weight:800;margin:6px 0 0"></p><div class="yupos-confirm-actions"><button type="button" class="yupos-confirm-cancel">Batal</button><button type="button" class="yupos-confirm-danger">Verifikasi</button></div></div>`;
    const titleEl = overlay.querySelector('.yupos-confirm-title'); if (titleEl) titleEl.textContent = title;
    const input = overlay.querySelector<HTMLInputElement>('.yupos-authority-pin');
    const verify = () => {
      if (input?.value === expectedPin) { const cb = pendingPinAction; pendingPinAction = null; close(); if (cb) { bypassNextConfirm = true; cb(); window.setTimeout(() => { bypassNextConfirm = false; }, 0); } }
      else { const error = overlay?.querySelector('.yupos-authority-error'); if (error) error.textContent = 'PIN / Sandi salah.'; if (input) { input.value = ''; input.focus(); } }
    };
    overlay.querySelector('.yupos-confirm-danger')?.addEventListener('click', verify);
    input?.addEventListener('keydown', (event) => { if (event.key === 'Enter') verify(); });
    overlay.querySelector('.yupos-confirm-cancel')?.addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay); input?.focus();
  };

  document.addEventListener('click', (event) => {
    if (bypassNextConfirm) return;
    const target = event.target as HTMLElement | null; const button = target?.closest('button') as HTMLButtonElement | null; if (!button) return;

    if ((button.textContent || '').trim() === '🖨️') {
      const pin = readPortalPins().printer || '';
      if (pin) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openPin('Otorisasi Printer', pin, () => button.click()); return; }
    }

    const sensitive = getSensitiveActionPin(button);
    if (sensitive) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openPin(sensitive.title, sensitive.pin, () => button.click()); return; }

    const isDeleteAction = Boolean(button.querySelector('svg.lucide-trash-2')); if (!isDeleteAction) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const row = button.closest('tr'); const name = row?.querySelector('td:first-child span.font-bold')?.textContent?.trim();
    open(name ? `Hapus "${name}" dari katalog produk?` : 'Hapus item ini dari katalog produk?', button);
  }, true);
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (message?: string) => bypassNextConfirm ? true : nativeConfirm(message);
}
installYuposConfirmBridge();

async function bootstrapYupos() {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('YUPOS root element (#root) was not found.');

  let unsubscribe: (() => void) | null = null;
  try {
    await new Promise<void>((resolve) => {
      let settled = false;
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (settled) return;
        settled = true;
        if (user?.uid) await hydrateMerchantDataFromFirebase(user.uid);
        resolve();
      });
    });
  } catch (error) {
    console.warn('YUPOS cloud bootstrap warning:', error);
  } finally {
    unsubscribe?.();
  }

  createRoot(rootElement).render(<StrictMode><AuthBootstrap><UpdateNotice /><App /></AuthBootstrap></StrictMode>);
}

void bootstrapYupos();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=8', { updateViaCache: 'none' }).then((registration) => registration.update()).catch((error) => console.warn('YUPOS service worker registration failed:', error));
  });
}
