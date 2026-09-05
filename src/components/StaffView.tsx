import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Clock, 
  Shield, 
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import { StoreSettings } from '../types';

interface StaffViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: Partial<StoreSettings>) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  settings,
  onUpdateSettings,
  onShowToast,
}) => {
  const [shift1, setShift1] = useState(settings.shift1Name || '');
  const [shift2, setShift2] = useState(settings.shift2Name || '');
  const [shift1Start, setShift1Start] = useState(settings.shift1Start || '10:00');
  const [shift1End, setShift1End] = useState(settings.shift1End || '13:00');
  const [shift2Start, setShift2Start] = useState(settings.shift2Start || '13:00');
  const [shift2End, setShift2End] = useState(settings.shift2End || '22:00');

  const [overrideSelect, setOverrideSelect] = useState<'auto' | '1' | '2'>(
    settings.manualOverride ? settings.activeShift : 'auto'
  );

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState(settings.staffRoles[0] || 'Petugas');

  // Delete modal state
  const [staffToDelete, setStaffToDelete] = useState<{ role: string; name: string } | null>(null);

  const handleSaveShift = () => {
    const isManual = overrideSelect !== 'auto';
    const activeShift = isManual ? (overrideSelect as '1' | '2') : settings.activeShift;

    onUpdateSettings({
      shift1Name: shift1,
      shift2Name: shift2,
      shift1Start,
      shift1End,
      shift2Start,
      shift2End,
      manualOverride: isManual,
      activeShift,
    });
    onShowToast('Pengaturan shift dan kasir berhasil disimpan!', 'success');
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      onShowToast('Masukkan nama karyawan / staf!', 'error');
      return;
    }

    const currentList = { ...settings.staffList };
    const roleStaff = currentList[newStaffRole] ? [...currentList[newStaffRole]] : [];

    if (roleStaff.includes(newStaffName.trim())) {
      onShowToast('Nama karyawan sudah ada di peran ini!', 'error');
      return;
    }

    roleStaff.push(newStaffName.trim());
    currentList[newStaffRole] = roleStaff;

    onUpdateSettings({ staffList: currentList });
    setNewStaffName('');
    onShowToast(`Karyawan "${newStaffName}" berhasil ditambahkan!`, 'success');
  };

  const handleConfirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const { role, name } = staffToDelete;
    const currentList = { ...settings.staffList };
    if (currentList[role]) {
      currentList[role] = currentList[role].filter((n) => n !== name);
      onUpdateSettings({ staffList: currentList });
      onShowToast(`Karyawan "${name}" berhasil dihapus dari ${role}!`, 'info');
    }
    setStaffToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Manajemen Karyawan & Pengaturan Shift
        </h2>
        <p className="text-xs text-slate-500 font-semibold mt-0.5">
          Atur nama kasir shift harian, mekanisme pergantian shift, dan anggota staf operasional.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 h-fit">
          <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Jadwal Shift & Kasir Aktif
            </h3>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Kasir Shift 1 (Pagi)
              </label>
              <input
                type="text"
                value={shift1}
                onChange={(e) => setShift1(e.target.value)}
                placeholder="Contoh: Budi Kasir"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Kasir Shift 2 (Sore/Malam)
              </label>
              <input
                type="text"
                value={shift2}
                onChange={(e) => setShift2(e.target.value)}
                placeholder="Contoh: Rian Kasir"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Custom Hours for Auto Shift */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <span className="text-[11px] font-black text-slate-700 block uppercase tracking-wide">
                Jam Operasional Auto Shift
              </span>
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                    Shift 1 (Pagi/Siang)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={shift1Start}
                      onChange={(e) => setShift1Start(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-400">s/d</span>
                    <input
                      type="time"
                      value={shift1End}
                      onChange={(e) => setShift1End(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                    Shift 2 (Sore/Malam)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={shift2Start}
                      onChange={(e) => setShift2Start(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-400">s/d</span>
                    <input
                      type="time"
                      value={shift2End}
                      onChange={(e) => setShift2End(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mode Pergantian Shift
              </label>
              <select
                value={overrideSelect}
                onChange={(e) => setOverrideSelect(e.target.value as 'auto' | '1' | '2')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto Shift (S1: {shift1Start}-{shift1End}, S2: {shift2Start}-{shift2End})</option>
                <option value="1">Paksa Aktifkan Shift 1 Sekarang</option>
                <option value="2">Paksa Aktifkan Shift 2 Sekarang</option>
              </select>
            </div>

            <button
              onClick={handleSaveShift}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all"
            >
              Simpan Pengaturan Shift
            </button>
          </div>
        </div>

        {/* Staff Members List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Daftar Staf Pelaksana & Petugas
            </h3>
          </div>

          {/* Add staff form */}
          <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Nama karyawan baru..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {settings.staffRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tambah
            </button>
          </form>

          {/* Grouped Staff List */}
          <div className="space-y-4 pt-2">
            {settings.staffRoles.map((role) => {
              const members = settings.staffList[role] || [];
              return (
                <div key={role} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      {role} ({members.length})
                    </span>
                  </div>

                  {members.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Belum ada karyawan terdaftar di peran ini.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-2xs group hover:border-red-200 transition-colors"
                        >
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => setStaffToDelete({ role, name })}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                            title={`Hapus ${name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delete Staff Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-blue-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Hapus Data Karyawan?
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda yakin ingin menghapus <strong>{staffToDelete.name}</strong> dari daftar peran <strong>{staffToDelete.role}</strong>?
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
