import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthBootstrap } from './components/AuthBootstrap';
import { UpdateNotice } from './components/UpdateNotice';
import './index.css';

function installYuposConfirmBridge() {
  let bypassNextConfirm = false;
  let activeButton: HTMLButtonElement | null = null;
  let overlay: HTMLDivElement | null = null;

  const close = () => { overlay?.remove(); overlay = null; activeButton = null; };
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
  document.addEventListener('click', (event) => {
    if (bypassNextConfirm) return;
    const target = event.target as HTMLElement | null; const button = target?.closest('button') as HTMLButtonElement | null; if (!button) return;
    const isDeleteAction = Boolean(button.querySelector('svg.lucide-trash-2')); if (!isDeleteAction) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const row = button.closest('tr'); const name = row?.querySelector('td:first-child span.font-bold')?.textContent?.trim();
    open(name ? `Hapus "${name}" dari katalog produk?` : 'Hapus item ini dari katalog produk?', button);
  }, true);
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = (message?: string) => bypassNextConfirm ? true : nativeConfirm(message);
}
installYuposConfirmBridge();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('YUPOS root element (#root) was not found.');
createRoot(rootElement).render(<StrictMode><AuthBootstrap><UpdateNotice /><App /></AuthBootstrap></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=7', { updateViaCache: 'none' }).then((registration) => registration.update()).catch((error) => console.warn('YUPOS service worker registration failed:', error));
  });
}
