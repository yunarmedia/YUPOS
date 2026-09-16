import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, History, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { APP_VERSION } from '../appVersion';

type Release = {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: string[];
};

type UpdateManifest = {
  latestVersion: string;
  releases: Release[];
};

const MANIFEST_URL = `${import.meta.env.BASE_URL}update-manifest.json`;

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map((v) => Number.parseInt(v, 10) || 0);
  const pb = b.split('.').map((v) => Number.parseInt(v, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const hardRefresh = async (): Promise<void> => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    window.location.reload();
  }
};

export const UpdateCenterView: React.FC = () => {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadManifest = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as UpdateManifest;
      if (!data?.latestVersion || !Array.isArray(data.releases)) throw new Error('Format update manifest tidak valid.');
      setManifest(data);
    } catch (err) {
      console.warn('Update Center manifest error:', err);
      setError('Informasi pembaruan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const latestRelease = useMemo(() => {
    if (!manifest) return null;
    return manifest.releases.find((release) => release.version === manifest.latestVersion)
      || [...manifest.releases].sort((a, b) => compareVersions(b.version, a.version))[0]
      || null;
  }, [manifest]);

  const hasUpdate = Boolean(latestRelease && compareVersions(latestRelease.version, APP_VERSION) > 0);
  const releases = useMemo(
    () => [...(manifest?.releases || [])].sort((a, b) => compareVersions(b.version, a.version)),
    [manifest],
  );

  const handleCheck = async () => {
    setChecking(true);
    await loadManifest(true);
  };

  const handleUpdate = async () => {
    setUpdating(true);
    await hardRefresh();
  };

  return (
    <section className="h-full overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-blue-200">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-[0.18em]">Pusat Bantuan • Update Center</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Pembaruan YUPOS</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Lihat versi aplikasi, pembaruan terbaru, dan perubahan fitur tanpa pop-up yang mengganggu pekerjaan kasir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCheck()}
              disabled={checking || loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-black backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Cek Pembaruan
            </button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Versi aplikasi sekarang</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-black text-slate-900">v{APP_VERSION}</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">Terpasang</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Versi terbaru</p>
            {loading ? (
              <div className="mt-3 h-7 w-24 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl font-black text-slate-900">v{latestRelease?.version || APP_VERSION}</span>
                {hasUpdate ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">Pembaruan tersedia</span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">Sudah terbaru</span>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{error}</div>
        )}

        {!loading && latestRelease && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-xs font-black uppercase tracking-wider">Update terbaru</span>
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-900">{latestRelease.title}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400">Dirilis {formatDate(latestRelease.date)}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">{latestRelease.summary}</p>
              </div>
              {hasUpdate && (
                <button
                  type="button"
                  onClick={() => void handleUpdate()}
                  disabled={updating}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
                >
                  <Download className={`h-4 w-4 ${updating ? 'animate-bounce' : ''}`} />
                  {updating ? 'Memperbarui...' : 'Update'}
                </button>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Yang ditambahkan / diubah pada versi ini</h3>
              <ul className="mt-3 space-y-2.5">
                {latestRelease.changes.map((change) => (
                  <li key={change} className="flex gap-2.5 text-sm font-medium leading-6 text-slate-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="flex w-full items-center justify-between p-5 text-left sm:p-6"
          >
            <span className="flex items-center gap-2.5 text-sm font-black text-slate-900"><History className="h-5 w-5 text-slate-500" /> Riwayat versi</span>
            <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <div className="space-y-3 border-t border-slate-100 p-5 sm:p-6">
              {releases.map((release) => (
                <article key={release.version} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-black text-slate-900">v{release.version}</span>
                      <span className="ml-2 text-xs font-semibold text-slate-400">{formatDate(release.date)}</span>
                    </div>
                    {release.version === APP_VERSION && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">VERSI ANDA</span>}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">{release.summary}</p>
                  <ul className="mt-2 space-y-1">
                    {release.changes.map((change) => <li key={change} className="text-xs leading-5 text-slate-500">• {change}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
