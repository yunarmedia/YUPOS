import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { MerchantUser } from '../types';
import { 
  Lock, 
  Mail, 
  Store, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Laptop,
  Check,
  MessageCircle,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';

interface MerchantLoginProps {
  onLoginSuccess: (user: MerchantUser) => void;
}

export const MerchantLogin: React.FC<MerchantLoginProps> = ({ onLoginSuccess }) => {
  // 'login' | 'purchase' | 'forgot'
  const [currentView, setCurrentView] = useState<'login' | 'purchase' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFullAccessOffer, setShowFullAccessOffer] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Harap masukkan email dan kata sandi merchant Anda!');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const merchantData: MerchantUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Merchant',
      };
      
      // Save session locally so user never has to re-login unless manually logged out
      try {
        localStorage.setItem('yupos_merchant_session', JSON.stringify(merchantData));
      } catch (e) {
        console.warn('Session save notice:', e);
      }

      onLoginSuccess(merchantData);
    } catch (err: any) {
      console.warn('Login verification notice:', err);
      let msg = 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
      if (
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/wrong-password' || 
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Email atau kata sandi tidak cocok dengan akun terdaftar. Pastikan akun resmi sudah aktif.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak valid (contoh: toko@gmail.com).';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Koneksi jaringan internet terputus. Mohon periksa kembali koneksi Anda.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan masuk. Mohon tunggu beberapa saat sebelum mencoba lagi.';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setErrorMessage('Harap masukkan alamat email akun merchant Anda!');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowFullAccessOffer(false);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMessage(
        `Kode rahasia dan petunjuk pemulihan kata sandi telah berhasil dikirimkan ke email ${targetEmail}. Silakan cek Kotak Masuk (Inbox) atau folder Spam di Gmail Anda.`
      );
    } catch (err: any) {
      console.warn('Reset password error:', err);
      let msg = 'Gagal mengirim instruksi reset kata sandi. Pastikan email Anda sudah terdaftar.';
      if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak valid.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'Email tersebut belum terdaftar di akun merchant resmi YUPOS.';
        setShowFullAccessOffer(true);
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak permintaan reset. Silakan coba lagi beberapa saat kemudian.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Koneksi internet bermasalah. Periksa jaringan lalu coba lagi.';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const waLink = "https://wa.me/6283842590642?text=Halo%20Developer%20YUPOS,%20saya%20tertarik%20untuk%20membeli%20dan%20mengaktifkan%20lisensi%20penuh%20aplikasi%20kasir%20YUPOS.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 p-5 sm:p-6 text-white text-center relative">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl ring-1 ring-white/10">
            <img src="/assets/icon-192.png" alt="YUPOS" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">One Pos For Everything</h1>
          <p className="text-blue-100 text-xs font-semibold mt-1">
            YUPOS • Sistem POS premium untuk berbagai bidang usaha
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 text-[10px] sm:text-[11px] font-bold text-blue-100 border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Sistem Kasir Cloud Terenkripsi
          </div>
        </div>

        {/* Top Navigation Tabs */}
        {currentView !== 'forgot' && (
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
            <button
              type="button"
              className={`flex-1 py-3 text-center transition-all ${
                currentView === 'login'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-extrabold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => {
                setCurrentView('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Masuk Kasir
            </button>
            <button
              type="button"
              className={`flex-1 py-3 text-center transition-all ${
                currentView === 'purchase'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600 font-extrabold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => {
                setCurrentView('purchase');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Daftar / Beli Lisensi
            </button>
          </div>
        )}

        {/* VIEW 1: LOGIN */}
        {currentView === 'login' && (
          <form onSubmit={handleLogin} className="p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-blue-700 font-bold flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-start gap-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">{successMessage}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Akun Merchant
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh: merchant@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Kata Sandi (Password)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setCurrentView('forgot');
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <span>Buka Aplikasi Kasir</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-500">
                Belum memiliki akun resmi kasir YuPOS?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('purchase');
                    setErrorMessage(null);
                  }}
                  className="text-blue-600 font-extrabold hover:underline"
                >
                  Daftar & Beli Lisensi
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW 2: PURCHASE / REGISTRATION PAGE (Strictly No Direct Register) */}
        {currentView === 'purchase' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-blue-600 text-[10px] font-black uppercase tracking-wider border border-red-200">
                Lisensi Penuh / Lifetime Access
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Dapatkan Aplikasi Penuh YuPOS
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Pendaftaran merchant baru memerlukan aktivasi lisensi resmi dari developer.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-3" />
                </div>
                <span>Akses Fitur Lengkap Tanpa Batas Waktu</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-3 h-3 stroke-3" />
                </div>
                <span>Mendukung HP, Tablet, Laptop, & PC Komputer</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-3" />
                </div>
                <span>Cetak Struk Bluetooth & Laporan Kas Laci Harian</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-3" />
                </div>
                <span>Tersimpan Otomatis & Data Bisnis Aman</span>
              </div>
            </div>

            {/* WhatsApp Developer CTA Button */}
            <div className="pt-1 space-y-2.5">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-black text-xs sm:text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
                <span>Hubungi Developer via WhatsApp</span>
              </a>

              <div className="text-center">
                <p className="text-[11px] font-bold text-slate-600">
                  Nomor WhatsApp:{' '}
                  <span className="text-emerald-700 font-extrabold select-all">
                    0838-4259-0642
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Setelah verifikasi pembelian, Anda akan langsung diberikan akun resmi untuk masuk ke aplikasi.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className="text-xs font-extrabold text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Sudah memiliki lisensi akun resmi? Masuk di sini
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: FORGOT PASSWORD (Secret Reset Code to Email) */}
        {currentView === 'forgot' && (
          <form onSubmit={handleResetPassword} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-extrabold text-slate-900">
                Atur Ulang Kata Sandi
              </h2>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Masukkan alamat email akun merchant Anda. Kami akan mengirimkan tautan kode rahasia ke kotak masuk Anda untuk membuat kata sandi baru.
            </p>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-blue-700 font-bold flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {showFullAccessOffer && (
              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-300 text-blue-950 font-black">Y</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-blue-950">Akun belum terdaftar</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Reset password hanya tersedia untuk email yang sudah memiliki akun merchant resmi di Firebase. Untuk mendapatkan akses penuh YUPOS, hubungi developer.</p>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-[11px] font-black text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Hubungi Developer untuk Akses Penuh
                    </a>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-start gap-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">{successMessage}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Email Terdaftar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="contoh: merchant@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Mengirim Kode Rahasia...</span>
              ) : (
                <>
                  <span>Kirim Kode Rahasia Reset Sandi</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
