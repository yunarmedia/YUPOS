import React, { useRef, useState } from 'react';
import { Archive, CheckCircle2, Download, FileSpreadsheet, RefreshCcw, ShieldCheck, Upload } from 'lucide-react';
import { backupCounts, exportBin, exportSpreadsheet, parseBackupFile, restoreBackup, BackupPayload } from '../services/backupService';

interface Props { onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void; }

export const BackupRestoreView: React.FC<Props> = ({ onShowToast }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { const parsed = await parseBackupFile(file); setPayload(parsed); onShowToast('File backup valid dan siap dipulihkan.', 'success'); }
    catch (e) { onShowToast(e instanceof Error ? e.message : 'File backup tidak dapat dibaca.', 'error'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const restore = async () => {
    if (!payload) return;
    if (mode === 'replace' && !window.confirm('Replace akan mengganti data kategori backup pada akun ini. Lanjutkan?')) return;
    setBusy(true);
    try { await restoreBackup(payload, mode); setPayload(null); onShowToast('Data berhasil dipulihkan dan disinkronkan.', 'success'); window.setTimeout(() => window.location.reload(), 500); }
    catch (e) { onShowToast(e instanceof Error ? e.message : 'Pemulihan data gagal.', 'error'); }
    finally { setBusy(false); }
  };
  const counts = payload ? backupCounts(payload) : null;

  return <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
    <div className="flex items-start gap-3"><div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Archive className="w-5 h-5" /></div><div><h3 className="font-black text-base text-slate-900">Backup & Pemulihan Data</h3><p className="text-xs text-slate-500 mt-1">Amankan data bisnis sebelum update dan pulihkan dari BIN atau Spreadsheet kapan saja.</p></div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button type="button" onClick={() => { try { exportBin(); onShowToast('Backup BIN berhasil dibuat.', 'success'); } catch (e) { onShowToast(e instanceof Error ? e.message : 'Gagal membuat backup.', 'error'); } }} className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-left flex items-center gap-3"><Download className="w-5 h-5 text-blue-600" /><span><b className="block text-xs">Download Backup BIN</b><small className="text-[11px] text-slate-500">Backup penuh, format internal YUPOS.</small></span></button>
      <button type="button" onClick={() => { try { exportSpreadsheet(); onShowToast('Spreadsheet backup berhasil dibuat.', 'success'); } catch (e) { onShowToast(e instanceof Error ? e.message : 'Gagal membuat spreadsheet.', 'error'); } }} className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-left flex items-center gap-3"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /><span><b className="block text-xs">Export Spreadsheet</b><small className="text-[11px] text-slate-500">XLSX dengan sheet produk, transaksi, pelanggan, dll.</small></span></button>
    </div>
    <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-3">
      <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-slate-700" /><span className="text-xs font-black">Pulihkan dari File</span></div>
      <input ref={inputRef} type="file" accept=".bin,.BIN,.xlsx,.XLSX,.xls,.XLS" onChange={(e) => void chooseFile(e.target.files?.[0])} className="block w-full text-xs" />
      <p className="text-[11px] text-slate-500">BIN paling aman untuk restore penuh. XLSX cocok untuk data yang ingin diperiksa atau dipindahkan.</p>
    </div>
    {payload && <div className="border border-blue-200 bg-blue-50/50 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 text-blue-700"><CheckCircle2 className="w-4 h-4" /><span className="text-xs font-black">Backup terdeteksi</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{[['Produk', counts!.products], ['Transaksi', counts!.orders], ['Pengeluaran', counts!.expenses], ['Pelanggan', counts!.customers], ['Settings', counts!.settings]].map(([label, value]) => <div key={String(label)} className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{String(value)}</b><span className="text-[10px] text-slate-500">{label}</span></div>)}</div>
      <div><label className="text-xs font-black block mb-2">Mode pemulihan</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('merge')} className={`p-3 rounded-xl border text-left ${mode === 'merge' ? 'border-blue-600 bg-white' : 'border-slate-200 bg-slate-50'}`}><b className="text-xs">Merge</b><span className="block text-[10px] text-slate-500 mt-1">Tambahkan/perbarui berdasarkan ID tanpa menghapus data sekarang.</span></button><button type="button" onClick={() => setMode('replace')} className={`p-3 rounded-xl border text-left ${mode === 'replace' ? 'border-red-500 bg-white' : 'border-slate-200 bg-slate-50'}`}><b className="text-xs">Replace</b><span className="block text-[10px] text-slate-500 mt-1">Ganti kategori data yang ada dengan isi backup.</span></button></div></div>
      <button type="button" disabled={busy} onClick={() => void restore()} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2"><RefreshCcw className="w-4 h-4" />{busy ? 'Memproses...' : 'Pulihkan Data Sekarang'}</button>
    </div>}
    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200"><ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5" /><p className="text-[11px] text-amber-800">Gunakan backup BIN sebelum update besar. File backup sebaiknya disimpan di tempat aman karena berisi data bisnis.</p></div>
  </section>;
};
