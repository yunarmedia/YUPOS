import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Rocket, Sparkles, X } from 'lucide-react';

const YUPOS_RELEASE_VERSION = '2.3.8';
const YUPOS_BUILD_ID = import.meta.env.VITE_BUILD_ID || YUPOS_RELEASE_VERSION;
const YUPOS_BUILD_KEY = 'yupos_last_seen_build';

const CHANGELOG = [
  'Layout struk thermal diperbarui untuk 58 mm dan 80 mm dengan margin, spacing, posisi logo, dan alignment yang lebih konsisten.',
  'QR Membership dibuat jauh lebih besar dan tajam dengan quiet zone 4 modul serta kotak QR berukuran integer agar hasil thermal mudah dipindai kamera HP.',
  'Barcode Code128 dihapus sepenuhnya dari preview, gambar struk, dan printer Bluetooth. Membership sekarang menggunakan QR saja.',
  'Payload QR Membership diperkecil agar jumlah modul QR tidak terlalu padat dan tetap cepat dipindai.',
  'Detail Membership pada struk menampilkan kode member, jumlah kunjungan, dan reward yang tersedia.',
  'Subtotal, diskon, PPN, total, dan metode pembayaran dirapikan agar struktur preview dan cetak lebih seragam.',
  'Typography diperbaiki: nama toko, item, total, membership, kode member, dan POWERED BY YUPOS menggunakan hierarchy yang lebih jelas.',
  'Logo thermal diraster dengan ukuran mengikuti lebar kertas dan diproses dengan kualitas lebih baik.',
  'Footer diberi jarak yang lebih jauh dan POWERED BY YUPOS dicetak bold di bagian paling bawah.',
  'QR generation sekarang sepenuhnya lokal sehingga tidak membutuhkan QuickChart, API key, internet, atau CORS untuk membuat QR.',
];

async function hardRefreshYupos() {
  try {
    localStorage.setItem(YUPOS_BUILD_KEY, YUPOS_BUILD_ID);
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) { console.warn('YUPOS hard refresh cleanup warning:', error); }
  finally {
    const url = new URL(window.location.href);
    url.searchParams.set('yupos_refresh', Date.now().toString());
    window.location.replace(url.toString());
  }
}

export const UpdateNotice: React.FC = () => {
  const [visible, setVisible] = useState(false); const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const lastSeenBuild = localStorage.getItem(YUPOS_BUILD_KEY);
    if (lastSeenBuild !== YUPOS_BUILD_ID) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(YUPOS_BUILD_KEY, YUPOS_BUILD_ID);
    setVisible(false);
  };

  const refresh = async () => { if (refreshing) return; setRefreshing(true); await hardRefreshYupos(); };
  if (!visible) return null;

  return (
    <div className="yupos-update-overlay" role="presentation">
      <div className="yupos-update-card" role="dialog" aria-modal="true" aria-labelledby="yupos-update-title">
        <div className="yupos-update-hero">
          <div className="yupos-update-rocket" aria-hidden="true"><Rocket className="w-8 h-8" strokeWidth={2.4} /></div>
          <div className="yupos-update-spark spark-one"><Sparkles className="w-4 h-4" /></div><div className="yupos-update-spark spark-two"><Sparkles className="w-3 h-3" /></div>
          <div className="yupos-update-orbit orbit-one" /><div className="yupos-update-orbit orbit-two" /><div className="yupos-update-wave wave-one" /><div className="yupos-update-wave wave-two" />
        </div>
        <button type="button" className="yupos-update-close" onClick={dismiss} aria-label="Tutup informasi update"><X className="w-4 h-4" /></button>
        <div className="yupos-update-body">
          <div className="yupos-update-heading-row"><div><div className="yupos-update-eyebrow">ABOUT UPDATE</div><h2 id="yupos-update-title" className="yupos-update-title">YUPOS diperbarui</h2></div><span className="yupos-update-version">V{YUPOS_RELEASE_VERSION}</span></div>
          <p className="yupos-update-description">Build YUPOS terbaru sudah berhasil diterapkan. Informasi ini muncul satu kali untuk setiap deployment baru.</p>
          <div className="yupos-update-list">{CHANGELOG.map((item,index)=><div className="yupos-update-item" key={item}><span className="yupos-update-number">{index+1}</span><span>{item}</span></div>)}</div>
          <button type="button" onClick={refresh} disabled={refreshing} className="yupos-update-refresh"><RefreshCw className={`w-5 h-5 ${refreshing?'animate-spin':''}`} /><span>{refreshing?'Memuat ulang...':'Refresh'}</span></button>
          <div className="yupos-update-note"><CheckCircle2 className="w-4 h-4" /><span>Refresh akan membersihkan cache aplikasi dan memuat build YUPOS terbaru.</span></div>
        </div>
      </div>
    </div>
  );
};
