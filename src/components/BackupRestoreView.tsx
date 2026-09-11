import React, { useRef, useState } from 'react';
import { Archive, CheckCircle2, Database, Download, FileSpreadsheet, RefreshCcw, ShieldCheck, Upload } from 'lucide-react';
import { backupCounts, exportBin, exportSpreadsheet, parseBackupFile, restoreBackup, BackupPayload } from '../services/backupService';
import { migrationCounts, parseSqlitePosFile, restoreSqliteMigration, MigrationPayload } from '../services/posMigrationService';

interface Props { onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void; }
type ImportPayload = { kind: 'yupos'; data: BackupPayload } | { kind: 'sqlite'; data: MigrationPayload };

export const BackupRestoreView: React.FC<Props> = ({ onShowToast }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.kasmdb') || name.endsWith('.sqlite') || name.endsWith('.sqlite3') || name.endsWith('.db')) {
        const parsed = await parseSqlitePosFile(file);
        setPayload({ kind: 'sqlite', data: parsed });
        onShowToast('Database POS terdeteksi dan siap dimigrasikan.', 'success');
      } else {
        const parsed = await parseBackupFile(file);
        setPayload({ kind: 'yupos', data: parsed });
        onShowToast('File backup valid dan siap dipulihkan.', 'success');
      }
    } catch (e) { onShowToast(e instanceof Error ? e.message : 'File tidak dapat dibaca.', 'error'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const restore = async () => {
    if (!payload) return;
    const isSqlite = payload.kind === 'sqlite';
    if (mode === 'replace' && !window.confirm(isSqlite ? 'Replace akan mengganti data YUPOS dengan data hasil migrasi. Lanjutkan?' : 'Replace akan mengganti data kategori backup pada akun ini. Lanjutkan?')) return;
    setBusy(true);
    try {
      if (isSqlite) await restoreSqliteMigration(payload.data, mode);
      else await restoreBackup(payload.data, mode);
      setPayload(null);
      onShowToast(isSqlite ? 'Database POS berhasil dimigrasikan ke YUPOS.' : 'Data berhasil dipulihkan dan disinkronkan.', 'success');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (e) { onShowToast(e instanceof Error ? e.message : 'Pemulihan data gagal.', 'error'); }
    finally { setBusy(false); }
  };

  const isSqlite = payload?.kind === 'sqlite';
  const counts = payload ? (isSqlite ? migrationCounts(payload.data) : backupCounts(payload.data)) : null;

  return <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-5">
    <div className="flex items-start gap-3"><div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Archive className="w-5 h-5" /></div><div><h3 className="font-black text-base text-slate-900">Backup & Pemulihan Data</h3><p className="text-xs text-slate-500 mt-1">Amankan data bisnis sebelum update dan pulihkan dari backup atau database POS lain.</p></div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button type="button" onClick={() => { try { exportBin(); onShowToast('Backup BIN berhasil dibuat.', 'success'); } catch (e) { onShowToast(e instanceof Error ? e.message : 'Gagal membuat backup.', 'error'); } }} className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-left flex items-center gap-3"><Download className="w-5 h-5 text-blue-600" /><span><b className="block text-xs">Download Backup BIN</b><small className="text-[11px] text-slate-500">Backup penuh, format internal YUPOS.</small></span></button>
      <button type="button" onClick={() => { try { exportSpreadsheet(); onShowToast('Spreadsheet backup berhasil dibuat.', 'success'); } catch (e) { onShowToast(e instanceof Error ? e.message : 'Gagal membuat spreadsheet.', 'error'); } }} className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-left flex items-center gap-3"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /><span><b className="block text-xs">Export Spreadsheet</b><small className="text-[11px] text-slate-500">XLSX dengan sheet produk, transaksi, pelanggan, dll.</small></span></button>
    </div>
    <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-3">
      <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-slate-700" /><span className="text-xs font-black">Pulihkan / Migrasikan Database</span></div>
      <input ref={inputRef} type="file" accept=".bin,.BIN,.xlsx,.XLSX,.xls,.XLS,.kasmdb,.KASMDB,.sqlite,.sqlite3,.db" onChange={(e) => void chooseFile(e.target.files?.[0])} className="block w-full text-xs" />
      <p className="text-[11px] text-slate-500">Mendukung backup YUPOS (.BIN/.XLSX) serta database SQLite POS tertentu (.KASMDB/.SQLITE/.DB). Database sumber dibaca lokal di perangkat.</p>
    </div>
    {payload && <div className="border border-blue-200 bg-blue-50/50 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 text-blue-700"><CheckCircle2 className="w-4 h-4" /><span className="text-xs font-black">{isSqlite ? `Database POS terdeteksi: ${payload.data.source}` : 'Backup YUPOS terdeteksi'}</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{counts?.products ?? 0}</b><span className="text-[10px] text-slate-500">Produk</span></div>
        <div className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{counts?.orders ?? 0}</b><span className="text-[10px] text-slate-500">Transaksi</span></div>
        <div className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{isSqlite ? counts?.expenses ?? 0 : counts?.expenses ?? 0}</b><span className="text-[10px] text-slate-500">Pengeluaran</span></div>
        <div className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{counts?.customers ?? 0}</b><span className="text-[10px] text-slate-500">Pelanggan</span></div>
        <div className="bg-white rounded-xl p-2 border border-blue-100"><b className="block text-sm">{isSqlite ? counts?.staff ?? 0 : 0}</b><span className="text-[10px] text-slate-500">Staff</span></div>
      </div>
      {isSqlite && payload.data.warnings.length > 0 && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200"><p className="text-[10px] font-black text-amber-800 mb-1">Catatan migrasi</p><ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-800">{payload.data.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div>}
      <div><label className="text-xs font-black block mb-2">Mode pemulihan</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setMode('merge')} className={`p-3 rounded-xl border text-left ${mode === 'merge' ? 'border-blue-600 bg-white' : 'border-slate-200 bg-slate-50'}`}><b className="text-xs">Merge</b><span className="block text-[10px] text-slate-500 mt-1">Gabungkan data tanpa menghapus data YUPOS yang sudah ada.</span></button><button type="button" onClick={() => setMode('replace')} className={`p-3 rounded-xl border text-left ${mode === 'replace' ? 'border-red-500 bg-white' : 'border-slate-200 bg-slate-50'}`}><b className="text-xs">Replace</b><span className="block text-[10px] text-slate-500 mt-1">Ganti data dengan isi database/backup yang dipilih.</span></button></div></div>
      <button type="button" disabled={busy} onClick={() => void restore()} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2"><RefreshCcw className="w-4 h-4" />{busy ? 'Memproses database...' : isSqlite ? 'Migrasikan Database ke YUPOS' : 'Pulihkan Data Sekarang'}</button>
    </div>}
    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200"><ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5" /><p className="text-[11px] text-amber-800">Untuk database POS lain, YUPOS hanya mengimpor data yang dikenali. PIN/kredensial sumber tidak dipindahkan.</p></div>
  </section>;
};
