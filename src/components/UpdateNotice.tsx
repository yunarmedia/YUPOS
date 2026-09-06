import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Rocket, Sparkles, X } from 'lucide-react';

const YUPOS_RELEASE_VERSION = '2.3.7';
const YUPOS_RELEASE_KEY = 'yupos_last_seen_release';

const CHANGELOG = [
  'QR Membership diperbaiki agar lebih stabil saat dicetak ke printer thermal.',
  'QR sekarang diraster dengan resolusi tinggi sebelum dikirim sebagai data ESC/POS.',
  'Koneksi Bluetooth BLE diperkuat dengan penulisan data yang lebih berurutan dan stabil.',
  'Pengiriman struk dibuat lebih aman terhadap paket data printer yang terlalu cepat.',
  'Footer "Powered by YUPOS" sekarang tampil tebal dan memiliki jarak yang lebih rapi.',
  'Perbaikan minor pada format dan spacing struk agar hasil cetak lebih konsisten dengan preview.',
];

async function hardRefreshYupos() {
  try {
    localStorage.setItem(YUPOS_RELEASE_KEY, YUPOS_RELEASE_VERSION);

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('YUPOS hard refresh cleanup warning:', error);
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('yupos_refresh', Date.now().toString());
    window.location.replace(url.toString());
  }
}

export const UpdateNotice: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(YUPOS_RELEASE_KEY);
    if (lastSeen !== YUPOS_RELEASE_VERSION) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(YUPOS_RELEASE_KEY, YUPOS_RELEASE_VERSION);
    setVisible(false);
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await hardRefreshYupos();
  };

  if (!visible) return null;

  return (
    <div className="yupos-update-overlay" role="presentation">
      <div className="yupos-update-card" role="dialog" aria-modal="true" aria-labelledby="yupos-update-title">
        <div className="yupos-update-hero">
          <div className="yupos-update-rocket" aria-hidden="true">
            <Rocket className="w-8 h-8" strokeWidth={2.4} />
          </div>
          <div className="yupos-update-spark spark-one"><Sparkles className="w-4 h-4" /></div>
          <div className="yupos-update-spark spark-two"><Sparkles className="w-3 h-3" /></div>
          <div className="yupos-update-orbit orbit-one" />
          <div className="yupos-update-orbit orbit-two" />
          <div className="yupos-update-wave wave-one" />
          <div className="yupos-update-wave wave-two" />
        </div>

        <button
          type="button"
          className="yupos-update-close"
          onClick={dismiss}
          aria-label="Tutup informasi update"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="yupos-update-body">
          <div className="yupos-update-heading-row">
            <div>
              <div className="yupos-update-eyebrow">ABOUT UPDATE</div>
              <h2 id="yupos-update-title" className="yupos-update-title">YUPOS diperbarui</h2>
            </div>
            <span className="yupos-update-version">V{YUPOS_RELEASE_VERSION}</span>
          </div>

          <p className="yupos-update-description">
            Versi terbaru YUPOS sudah tersedia. Berikut detail perbaikan dan perubahan pada update ini.
          </p>

          <div className="yupos-update-list">
            {CHANGELOG.map((item, index) => (
              <div className="yupos-update-item" key={item}>
                <span className="yupos-update-number">{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="yupos-update-refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memuat ulang...' : 'Refresh'}</span>
          </button>

          <div className="yupos-update-note">
            <CheckCircle2 className="w-4 h-4" />
            <span>Refresh akan membersihkan cache aplikasi dan memuat build YUPOS terbaru.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
