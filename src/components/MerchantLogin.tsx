import React, { useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { MerchantUser } from '../types';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, MessageCircle, ShieldCheck, Sparkles, Cloud, Printer, BarChart3, Users, Smartphone } from 'lucide-react';
import { YuposLogo } from './YuposLogo';

interface MerchantLoginProps { onLoginSuccess: (user: MerchantUser) => void; }
const VIDEO_URL = 'https://videotourl.com/videos/1788611619946-72d41d3a-82ac-43d2-88f0-45ca519d71f3.mp4';
const WA_LINK = 'https://wa.me/6283842590642?text=Halo%20Developer%20YUPOS,%20saya%20tertarik%20untuk%20membeli%20dan%20mengaktifkan%20lisensi%20penuh%20aplikasi%20kasir%20YUPOS.';
const UNREGISTERED_MESSAGE = 'Akun Anda belum terdaftar, Hubungi Developer untuk membeli lisensi';

export const MerchantLogin: React.FC<MerchantLoginProps> = ({ onLoginSuccess }) => {
  const [currentView, setCurrentView] = useState<'login' | 'purchase' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => { setErrorMessage(null); setSuccessMessage(null); };
  const switchView = (view: 'login' | 'purchase' | 'forgot') => {
    setCurrentView(view);
    clearMessages();
    if (view === 'forgot') setResetEmail(email.trim());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMessage('Masukkan email dan kata sandi akun merchant Anda.');
      return;
    }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = credential.user;
      onLoginSuccess({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Merchant',
      });
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/user-not-found') {
        setErrorMessage(UNREGISTERED_MESSAGE);
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('Format email tidak valid.');
      } else {
        setErrorMessage('Email atau kata sandi tidak sesuai dengan akun merchant YUPOS.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage(UNREGISTERED_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMessage('Tautan reset kata sandi telah dikirim ke email terdaftar. Periksa Inbox atau Spam.');
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setErrorMessage(UNREGISTERED_MESSAGE);
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('Format email tidak valid.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Terlalu banyak permintaan reset. Tunggu beberapa saat lalu coba lagi.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');
      } else {
        setErrorMessage(UNREGISTERED_MESSAGE);
      }
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="relative flex items-center">
      <div className="pointer-events-none absolute left-4 text-slate-400">{icon}</div>
      {children}
    </div>
  );

  const AlertBox = () => (
    <>
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
      <video className="absolute inset-0 h-full w-full object-cover" src={VIDEO_URL} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/90 via-blue-900/55 to-slate-950/85" />

      <div className="relative z-10 flex min-h-full items-center justify-center px-3 py-5 sm:px-6 sm:py-8">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/15 bg-white/95 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-xl lg:grid-cols-[1fr_1fr]">
          <section className="hidden min-h-[680px] flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-blue-950 p-8 text-white lg:flex xl:p-10">
            <div>
              <YuposLogo size={62} showWordmark />
              <div className="mt-14 max-w-md">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1.5 text-[10px] font-black tracking-wide text-yellow-200">
                  <Sparkles className="h-3.5 w-3.5" /> PREMIUM POS PLATFORM
                </div>
                <h1 className="text-4xl font-black leading-[1.05] tracking-tight xl:text-5xl">Satu POS untuk seluruh operasional bisnis.</h1>
                <p className="mt-5 text-sm font-medium leading-7 text-blue-100">Transaksi, produk, customer, kas, laporan, karyawan, shift, dan printer dalam satu sistem POS yang siap digunakan di berbagai jenis usaha.</p>
              </div>
              <div className="mt-9 grid grid-cols-2 gap-3">
                {[
                  [Cloud, 'Cloud Data', 'Data terisolasi per merchant'],
                  [Smartphone, 'Multi Device', 'HP, tablet, laptop & PC'],
                  [Printer, 'Thermal Printer', 'Bluetooth ESC/POS'],
                  [BarChart3, 'Business Reports', 'Omzet, kas & ekspor data'],
                ].map(([Icon, title, desc]) => {
                  const IconComponent = Icon as React.ComponentType<{ className?: string }>;
                  return <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><IconComponent className="h-5 w-5 text-yellow-300" /><div className="mt-2 text-sm font-black">{title}</div><div className="mt-1 text-[11px] text-blue-100">{desc}</div></div>;
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-100"><ShieldCheck className="h-4 w-4 text-yellow-300" /> Akses merchant dikelola melalui Firebase Authentication.</div>
          </section>

          <section className="flex min-h-[620px] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-8">
              <YuposLogo size={42} showWordmark darkText />
              <div className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-blue-700 sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> SECURE ACCESS</div>
            </div>

            {currentView !== 'forgot' && (
              <div className="grid grid-cols-2 border-b border-slate-200">
                <button type="button" onClick={() => switchView('login')} className={`px-4 py-4 text-sm font-black transition ${currentView === 'login' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>Masuk Kasir</button>
                <button type="button" onClick={() => switchView('purchase')} className={`px-4 py-4 text-sm font-black transition ${currentView === 'purchase' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>Daftar / Beli Lisensi</button>
              </div>
            )}

            {currentView === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-1 flex-col justify-center p-6 sm:p-8">
                <div className="mb-7"><div className="mb-2 text-xs font-black uppercase tracking-[.16em] text-yellow-600">Merchant Portal</div><h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Masuk ke YUPOS</h2><p className="mt-2 text-sm text-slate-500">Gunakan email merchant yang telah didaftarkan oleh developer.</p></div>
                <div className="space-y-4">
                  <AlertBox />
                  <div><label className="mb-2 block text-xs font-black text-slate-700">EMAIL MERCHANT</label><Field icon={<Mail className="h-5 w-5" />}><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="merchant@gmail.com" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /></Field></div>
                  <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-black text-slate-700">KATA SANDI</label><button type="button" onClick={() => switchView('forgot')} className="text-xs font-black text-blue-600 hover:text-blue-800">Lupa sandi?</button></div><Field icon={<LockKeyhole className="h-5 w-5" />}><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></Field></div>
                  <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Memverifikasi akun...' : <>Buka Aplikasi Kasir <ArrowRight className="h-5 w-5" /></>}</button>
                </div>
                <div className="mt-7 rounded-2xl border border-yellow-200 bg-yellow-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" /><div><div className="text-xs font-black text-slate-900">Akun resmi YUPOS</div><div className="mt-1 text-[11px] leading-5 text-slate-600">Tidak ada pendaftaran otomatis. Akun hanya dibuat oleh developer melalui Firebase Authentication.</div></div></div></div>
              </form>
            )}

            {currentView === 'forgot' && (
              <form onSubmit={handleResetPassword} className="flex flex-1 flex-col justify-center p-6 sm:p-8">
                <button type="button" onClick={() => switchView('login')} className="mb-7 flex w-fit items-center gap-2 text-xs font-black text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Kembali ke masuk</button>
                <div className="mb-7"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><KeyRound className="h-6 w-6" /></div><h2 className="text-2xl font-black tracking-tight text-slate-950">Pulihkan kata sandi</h2><p className="mt-2 text-sm leading-6 text-slate-500">Hanya email yang sudah didaftarkan developer di Firebase Authentication yang dapat menerima tautan reset.</p></div>
                <div className="space-y-4"><AlertBox /><div><label className="mb-2 block text-xs font-black text-slate-700">EMAIL TERDAFTAR</label><Field icon={<Mail className="h-5 w-5" />}><input type="email" autoComplete="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="merchant@gmail.com" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /></Field></div><button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60">{loading ? 'Memproses...' : <>Kirim Tautan Reset <ArrowRight className="h-5 w-5" /></>}</button></div>
                <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-[11px] leading-5 text-slate-600"><b className="text-slate-900">Belum terdaftar?</b> {UNREGISTERED_MESSAGE}.</div>
              </form>
            )}

            {currentView === 'purchase' && (
              <div className="flex flex-1 flex-col justify-center overflow-y-auto p-6 sm:p-8">
                <div className="mb-6"><div className="mb-2 text-xs font-black uppercase tracking-[.16em] text-yellow-600">FULL ACCESS LICENSE</div><h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Dapatkan YUPOS untuk bisnis Anda</h2><p className="mt-2 text-sm leading-6 text-slate-500">Lisensi penuh memberikan akses ke fitur POS profesional tanpa registrasi otomatis atau akun trial.</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    [Check, 'POS Multi Bisnis', 'Barbershop, salon, F&B, retail, laundry, workshop & custom'],
                    [Cloud, 'Cloud Data', 'Data bisnis tersinkron dan terisolasi untuk setiap merchant'],
                    [Printer, 'Bluetooth Thermal', 'Cetak struk ESC/POS langsung dari perangkat yang kompatibel'],
                    [BarChart3, 'Laporan & Ekspor', 'Omzet, kas, pengeluaran dan ekstrak data untuk operasional'],
                    [Users, 'Customer & Membership', 'Database pelanggan, kunjungan, member dan total belanja'],
                    [Smartphone, 'Multi Device', 'Antarmuka responsif untuk HP, tablet, laptop dan PC'],
                  ].map(([Icon, title, desc]) => { const IconComponent = Icon as React.ComponentType<{ className?: string }>; return <div key={String(title)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><IconComponent className="h-4.5 w-4.5" /></span><div className="text-xs font-black text-slate-900">{title}</div></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{desc}</p></div>; })}
                </div>
                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" /><div><div className="text-xs font-black text-slate-900">Lisensi dikelola developer</div><p className="mt-1 text-[11px] leading-5 text-slate-600">Setelah pembelian, developer mendaftarkan email Anda ke Firebase Authentication. Setelah akun aktif, Anda dapat login dan menggunakan fitur reset sandi secara mandiri.</p></div></div></div>
                <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700"><MessageCircle className="h-5 w-5" /> Hubungi Developer untuk Membeli Lisensi</a>
                <button type="button" onClick={() => switchView('login')} className="mt-4 text-xs font-black text-slate-500 hover:text-blue-600">Sudah punya akun? Masuk ke YUPOS</button>
              </div>
            )}

            <div className="border-t border-slate-100 px-6 py-4 text-center text-[10px] font-semibold text-slate-400 sm:px-8">YUPOS • One Pos For Everything • Secure Merchant Access</div>
          </section>
        </div>
      </div>
    </div>
  );
};
