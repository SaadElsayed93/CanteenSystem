import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Database, ShieldCheck, HardDrive, Download, Upload, RotateCcw, 
  Trash2, AlertTriangle, CheckCircle2, Clock, FileCheck, Save, 
  RefreshCw, FolderOpen, Lock, ShieldAlert, Copy
} from 'lucide-react';

const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} — ${hours}:${minutes}:${seconds} ${ampm}`;
};

const typeMap = {
  'MANUAL': { label: 'يدوي بطلب المدير', color: 'bg-emerald-50 text-[#007507] border-emerald-200' },
  'AUTO': { label: 'تلقائي مجدول (يومياً)', color: 'bg-emerald-100 text-[#003607] border-emerald-300' },
  'SHIFT_CLOSE': { label: 'تقفيل وردية ويومية', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  'STARTUP': { label: 'وقائي عند تشغيل السيرفر', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'SAFETY_PRE_RESTORE': { label: 'أمان تلقائي قبل استرجاع', color: 'bg-rose-100 text-rose-800 border-rose-200' }
};

const BackupPage = () => {
  const [backups, setBackups] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalSizeBytes: 0,
    totalSizeFormatted: '0 MB',
    lastBackupTime: null,
    externalPath: '',
    schedule: { enabled: true, time: '00:00', lastAutoBackupTime: null }
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupNotes, setBackupNotes] = useState('');
  
  // External Path State
  const [externalPath, setExternalPath] = useState('');
  const [savingPath, setSavingPath] = useState(false);

  // Scheduled Auto Backup State
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTime, setScheduleTime] = useState('00:00');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [testingAuto, setTestingAuto] = useState(false);

  // Restore Modal State
  const [selectedForRestore, setSelectedForRestore] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Upload Restore State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingRestore, setUploadingRestore] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await client.get('/backups');
      if (res.data?.success) {
        setBackups(res.data.data.backups || []);
        const s = res.data.data.stats || {};
        setStats(s);
        setExternalPath(s.externalPath || '');
        if (s.schedule) {
          setScheduleEnabled(s.schedule.enabled !== false);
          setScheduleTime(s.schedule.time || '00:00');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('تعذر جلب سجل النسخ الاحتياطية');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await client.post('/backups/settings/schedule', {
        enabled: scheduleEnabled,
        time: scheduleTime
      });
      if (res.data?.success) {
        toast.success('تم حفظ وضبط توقيت النسخ الاحتياطي التلقائي بنجاح ⏰');
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'تعذر حفظ إعدادات الجدولة');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleTriggerAutoBackup = async () => {
    setTestingAuto(true);
    const toastId = toast.loading('جاري تشغيل واختبار النسخة التلقائية المجدولة فورياً...');
    try {
      const res = await client.post('/backups/trigger-auto');
      if (res.data?.success) {
        toast.success(`تم أخذ النسخة التلقائية بنجاح: ${res.data.data.filename} 🛡️`, { id: toastId });
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'فشل تشغيل النسخة التلقائية', { id: toastId });
    } finally {
      setTestingAuto(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await client.post('/backups', {
        type: 'MANUAL',
        notes: backupNotes.trim()
      });
      if (res.data?.success) {
        toast.success('تم إنشاء وحفظ النسخة الاحتياطية بنجاح 🛡️');
        setBackupNotes('');
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'فشل إنشاء النسخة الاحتياطية');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveExternalPath = async () => {
    setSavingPath(true);
    try {
      const res = await client.post('/backups/settings/external-path', {
        externalPath: externalPath.trim()
      });
      if (res.data?.success) {
        toast.success('تم ضبط مسار التخزين الخارجي بنجاح ✅');
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'تعذر حفظ مسار التخزين الخارجي');
    } finally {
      setSavingPath(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (backup) => {
    setDownloadingId(backup.id);
    const toastId = toast.loading(`جاري تحضير وتنزيل النسخة: ${backup.filename}...`);
    try {
      const response = await client.get(`/backups/${backup.id}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', backup.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('تم تنزيل النسخة الاحتياطية بنجاح 📥', { id: toastId });
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: direct window open with auth token in query param
      try {
        const token = localStorage.getItem('token');
        window.open(`/api/backups/${backup.id}/download?token=${token}`, '_blank');
        toast.success('تم بدء التنزيل المباشر 📥', { id: toastId });
      } catch (e) {
        toast.error('تعذر تنزيل ملف النسخة الاحتياطية', { id: toastId });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyFolderLocation = () => {
    const dir = stats.backupDir || 'D:\\كانتين\\CanteenSystem\\backend\\backups';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(dir).then(() => {
        toast.success('تم نسخ مسار مجلد النسخ الاحتياطية إلى الحافظة 📋');
      }).catch(() => {
        toast.success(`المسار الفعلي: ${dir}`);
      });
    } else {
      toast.success(`المسار الفعلي: ${dir}`);
    }
  };

  const handleCopyFileLocation = (backup) => {
    const filePath = backup.filepath || `${stats.backupDir || 'D:\\كانتين\\CanteenSystem\\backend\\backups'}\\${backup.filename}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(filePath).then(() => {
        toast.success(`تم نسخ مسار النسخة: ${backup.filename} 📋`);
      }).catch(() => {
        toast.success(`المسار الفعلي: ${filePath}`);
      });
    } else {
      toast.success(`المسار الفعلي: ${filePath}`);
    }
  };

  const handleDelete = async (backup) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف النسخة الاحتياطية: "${backup.filename}" نهائياً؟`)) {
      return;
    }
    try {
      await client.delete(`/backups/${backup.id}`);
      toast.success('تم حذف النسخة بنجاح');
      fetchBackups();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'فشل حذف النسخة');
    }
  };

  const handleExecuteRestore = async () => {
    if (confirmText.trim() !== 'استرجاع') {
      toast.error('يرجى كتابة كلمة "استرجاع" للتأكيد الأمني');
      return;
    }

    setRestoring(true);
    try {
      const res = await client.post(`/backups/${selectedForRestore.id}/restore`);
      if (res.data?.success) {
        toast.success('تم استرجاع قاعدة البيانات بنجاح تام! تم حفظ نسخة أمان للوضع السابق 🛡️', { duration: 6000 });
        setSelectedForRestore(null);
        setConfirmText('');
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'فشل استرجاع قاعدة البيانات');
    } finally {
      setRestoring(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
        toast.error('يرجى اختيار ملف قاعدة بيانات صالح بصيغة (.db أو .sqlite)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndRestore = async () => {
    if (!selectedFile) {
      toast.error('يرجى اختيار ملف نسخة أولاً');
      return;
    }

    if (!window.confirm(`تحذير أمني: أنت على وشك استرجاع قاعدة بيانات كاملة من الملف المرفوع "${selectedFile.name}". هل أنت متأكد تماماً؟`)) {
      return;
    }

    setUploadingRestore(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await client.post('/backups/upload-restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        toast.success('تم فحص ورفع واسترجاع قاعدة البيانات بنجاح تام 🛡️', { duration: 6000 });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchBackups();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'فشل رفع واسترجاع الملف');
    } finally {
      setUploadingRestore(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Brand Identity Style */}
      <div className="bg-gradient-to-l from-[#003607] via-[#007507] to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden border border-emerald-800/40">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-emerald-300">
              <ShieldCheck size={28} />
            </span>
            <div>
              <h1 className="text-2xl font-black">مركز النسخ الاحتياطي وإدارة الأمان</h1>
              <p className="text-emerald-100/90 text-xs font-bold mt-0.5">
                حماية شاملة لقاعدة بيانات الكانتين ضد أي أعطال أو انقطاع للكهرباء مع إمكانية الاسترداد الفوري
              </p>
            </div>
          </div>
        </div>

        <div className="z-10 flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleCopyFolderLocation}
            className="flex items-center gap-2 bg-[#1bb641] hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
            title="نسخ مسار مجلد النسخ الفعلي على السيرفر"
          >
            <Copy size={16} />
            <span>نسخ مسار مجلد النسخ</span>
          </button>

          <button 
            onClick={fetchBackups} 
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
            <span>تحديث السجل</span>
          </button>
        </div>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: System Status */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">حالة الأمان والجاهزية</p>
              <h3 className="text-lg font-black text-[#007507] mt-1">قاعدة البيانات مؤمنة</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-[#007507] rounded-xl">
              <ShieldCheck size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
            جاهزية الاسترداد والنسخ الحي 100%
          </div>
        </div>

        {/* Card 2: Last Backup */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">توقيت آخر نسخة مسجلة</p>
              <h3 className="text-sm font-black text-slate-800 mt-1 truncate" title={formatDateTime(stats.lastBackupTime)}>
                {stats.lastBackupTime ? formatDateTime(stats.lastBackupTime) : 'لا توجد نسخ بعد'}
              </h3>
            </div>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
            <span>مجدول: {scheduleTime === '00:00' ? '12:00 منتصف الليل' : scheduleTime}</span>
            <span className="w-2 h-2 rounded-full bg-[#1bb641] animate-pulse"></span>
          </div>
        </div>

        {/* Card 3: Total Archive (100 Max Limit & Auto-Rotation) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">إجمالي أرشيف النسخ</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                {stats.totalCount} <span className="text-xs font-bold text-emerald-700">/ 100 نسخة كحد أقصى</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-[#007507] rounded-xl">
              <Database size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-[#007507] bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 flex items-center justify-between">
            <span>المساحة: {stats.totalSizeFormatted}</span>
            <span className="text-[10px] bg-white text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">تدوير وحذف تلقائي</span>
          </div>
        </div>

        {/* Card 4: External USB Path */}
        <div className="bg-white p-5 rounded-2xl border-2 border-amber-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">النسخ الخارجي (فلاشة USB)</p>
              <h3 className="text-sm font-black text-slate-800 mt-1 truncate" title={stats.externalPath || 'غير مفعل'}>
                {stats.externalPath ? 'مفعل على المسار المحدد' : 'غير محدد حالياً'}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <HardDrive size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-100 truncate">
            {stats.externalPath || 'يمكنك تحديد مسار فلاشة بالأسفل'}
          </div>
        </div>
      </div>

      {/* Automated Daily Scheduled Backup Panel */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-[#003607] text-white p-6 rounded-3xl shadow-md border-2 border-slate-700 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-white/10 backdrop-blur rounded-2xl text-emerald-400 border border-white/10">
              <Clock size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-wide">النسخ الاحتياطي التلقائي المجدول (Daily Auto-Backup)</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${scheduleEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                  {scheduleEnabled ? '● النظام التلقائي نَشِط' : '○ متوقف'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-300 mt-0.5">
                يقوم النظام تلقائياً بأخذ نسخة كاملة من قاعدة البيانات يومياً في الموعد المحدد وحفظها بأمان دون أي تدخل بشري
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerAutoBackup}
            disabled={testingAuto}
            className="px-4 py-2.5 bg-[#1bb641] hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            {testingAuto ? (
              <>
                <RotateCcw size={15} className="animate-spin" />
                <span>جاري أخذ النسخة التلقائية...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>تشغيل تجريبي فوري للنسخة المجدولة ⚡</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-end">
          {/* Time Picker */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">
              توقيت النسخ اليومي التلقائي:
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="time" 
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="w-full bg-white/10 border-2 border-slate-600 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-[#1bb641] text-center"
                dir="ltr"
              />
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                {scheduleTime === '00:00' ? '(منتصف الليل 12:00 ص)' : ''}
              </span>
            </div>
          </div>

          {/* Toggle Enable */}
          <div>
            <label className="block text-xs font-black text-slate-300 mb-1.5">
              حالة التفعيل:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border transition-colors cursor-pointer ${scheduleEnabled ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200' : 'bg-white/5 border-white/20 text-gray-400'}`}
              >
                <CheckCircle2 size={16} className={scheduleEnabled ? 'text-emerald-400' : 'text-gray-500'} />
                <span>{scheduleEnabled ? 'الجدولة اليومية مفعلة' : 'الجدولة معطلة مؤقتاً'}</span>
              </button>
            </div>
          </div>

          {/* Save Settings */}
          <div>
            <button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="w-full py-2.5 bg-[#007507] hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow border border-emerald-500/40 disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              <span>{savingSchedule ? 'جاري الحفظ...' : 'حفظ إعدادات الجدولة 💾'}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-400 border-t border-white/10">
          <div>
            📂 مسار الحفظ المزدوج: <span className="text-white font-mono" dir="ltr">{stats.backupDir || 'السيرفر/backups'}</span>
            {stats.externalPath ? (
              <span className="text-amber-300 mr-2 font-mono" dir="ltr">+ {stats.externalPath} (فلاشة خارجية)</span>
            ) : null}
          </div>
          {stats.schedule?.lastAutoBackupTime && (
            <div className="text-emerald-300">
              ✓ آخر نسخة تلقائية أُخذت بنجاح: {formatDateTime(stats.schedule.lastAutoBackupTime)}
            </div>
          )}
        </div>
      </div>

      {/* Main Action Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Create Backup Now & USB Setup */}
        <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <span className="p-2 bg-emerald-50 text-[#007507] rounded-xl">
              <Save size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-gray-800">إنشاء نسخة احتياطية فورية</h3>
              <p className="text-gray-400 font-bold text-xs">أخذ لقطة كاملة آمنة من الوضع الحالي بدون أي تعطيل للبيع</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-600 mb-1.5">ملاحظة أو سبب النسخة (اختياري):</label>
              <input 
                type="text" 
                placeholder="مثلاً: قبل تعديل أسعار الأصناف، أو نسخة أسبوعية..." 
                value={backupNotes}
                onChange={e => setBackupNotes(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-[#007507] bg-gray-50/50"
              />
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="w-full py-3.5 bg-[#007507] hover:bg-[#006006] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {creating ? (
                <>
                  <RotateCcw size={18} className="animate-spin" />
                  <span>جاري إنشاء وتأمين النسخة الاحتياطية...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>إنشاء وحفظ نسخة احتياطية الآن</span>
                </>
              )}
            </button>
          </div>

          {/* External USB Backup Setup */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-gray-700">
              <HardDrive size={16} className="text-amber-600" />
              <span>النسخ المتزامن على فلاشة ميموري أو مسار خارجي:</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="مثلاً: E:\CanteenBackups أو F:\نسخ_الكانتين" 
                value={externalPath}
                onChange={e => setExternalPath(e.target.value)}
                className="flex-1 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-[#007507] bg-gray-50/50"
                dir="ltr"
              />
              <button
                onClick={handleSaveExternalPath}
                disabled={savingPath}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Save size={15} />
                <span>{savingPath ? 'جاري الحفظ...' : 'حفظ المسار'}</span>
              </button>
            </div>
            <p className="text-[11px] font-bold text-gray-400">
              * عند ضبط مسار فلاشة متصلة، سيقوم النظام تلقائياً بنسخ كل بيك أب يتم إنشاؤه إلى الفلاشة فورياً لحمايتك في حال تعطل جهاز الكمبيوتر نفسه.
            </p>
          </div>
        </div>

        {/* Panel 2: Upload & Restore from Outside */}
        <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Upload size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-gray-800">استعادة قاعدة بيانات من ملف خارجي</h3>
              <p className="text-gray-400 font-bold text-xs">رفع ملف نسخة سابقة (.db) من فلاشة أو جهاز آخر وتشغيل السيستم عليها</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center text-center">
              <FolderOpen size={36} className="text-[#007507] mb-2" />
              <p className="font-black text-xs text-gray-700 mb-1">
                {selectedFile ? selectedFile.name : 'اسحب ملف النسخة (.db) هنا أو اضغط للاختيار'}
              </p>
              <p className="text-[11px] font-bold text-gray-400 mb-3">
                {selectedFile ? `الحجم: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'الملفات المدعومة: .db أو .sqlite فقط'}
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".db,.sqlite" 
                onChange={handleFileChange}
                className="hidden" 
                id="backup-file-input"
              />
              <label 
                htmlFor="backup-file-input"
                className="px-4 py-2 bg-white border-2 border-gray-200 hover:border-[#007507] rounded-xl text-xs font-black text-gray-700 cursor-pointer shadow-sm hover:text-[#007507] transition-colors"
              >
                {selectedFile ? 'تغيير الملف المحدد' : 'اختيار ملف من الجهاز'}
              </label>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-start gap-2">
              <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>شبكة الأمان التلقائية:</strong> لا داعي للقلق؛ قبل تطبيق أي استرجاع، يقوم السيرفر بأخذ نسخة أمان إجبارية من قاعدة البيانات الحالية تلقائياً لحمايتك في حال كان الملف المرفوع خاطئاً.
              </span>
            </div>

            <button
              onClick={handleUploadAndRestore}
              disabled={!selectedFile || uploadingRestore}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploadingRestore ? (
                <>
                  <RotateCcw size={18} className="animate-spin" />
                  <span>جاري فحص وتطبيق النسخة المسترجعة...</span>
                </>
              ) : (
                <>
                  <Upload size={18} />
                  <span>فحص واسترجاع النسخة المرفوعة الآن</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Backup Archive Table */}
      <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <Database size={20} className="text-[#007507]" />
              <span>سجل وأرشيف النسخ الاحتياطية</span>
            </h3>
            <p className="text-gray-400 font-bold text-xs mt-0.5">
              كافة النسخ المحفوظة على السيرفر مصنفة حسب التوقيت والنوع مع خيارات التحميل والاسترجاع الفوري
            </p>
          </div>
          <span className="text-xs font-black bg-emerald-50 text-[#007507] px-3 py-1.5 rounded-xl border border-emerald-200">
            {backups.length} نسخة محفوظة (أقصى حد: 100)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs font-black">
              <tr>
                <th className="p-4 border-b">اسم النسخة الاحتياطية</th>
                <th className="p-4 border-b">النوع ومصدر النسخة</th>
                <th className="p-4 border-b">توقيت الإنشاء</th>
                <th className="p-4 border-b">حجم الملف</th>
                <th className="p-4 border-b">المستخدم المنفذ</th>
                <th className="p-4 border-b text-center">الإجراءات والتحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-700">
              {backups.map(backup => {
                const typeInfo = typeMap[backup.type] || {
                  label: backup.type,
                  color: 'bg-gray-100 text-gray-800 border-gray-200'
                };

                return (
                  <tr key={backup.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-[#007507] flex-shrink-0" />
                        <span className="font-mono text-gray-900 font-black" dir="ltr">
                          {backup.filename}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>

                    <td className="p-4 text-gray-500 font-mono" dir="ltr">
                      {formatDateTime(backup.createdAt)}
                    </td>

                    <td className="p-4 font-mono font-black text-gray-800">
                      {backup.sizeFormatted}
                    </td>

                    <td className="p-4">
                      {backup.user?.fullName || backup.user?.username || 'النظام التلقائي'}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(backup)}
                          disabled={downloadingId === backup.id}
                          title="تنزيل النسخة (.db) إلى جهازك مباشرة"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-[#007507] border border-emerald-200 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {downloadingId === backup.id ? (
                            <RotateCcw size={15} className="animate-spin text-emerald-600" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>

                        {/* Copy File Location on Server */}
                        <button
                          onClick={() => handleCopyFileLocation(backup)}
                          title="نسخ المسار الفعلي لملف النسخة على السيرفر"
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl transition-colors shadow-sm cursor-pointer"
                        >
                          <Copy size={15} />
                        </button>

                        {/* Restore Button */}
                        <button
                          onClick={() => {
                            setSelectedForRestore(backup);
                            setConfirmText('');
                          }}
                          title="استرجاع قاعدة البيانات لهذه النسخة"
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl transition-colors shadow-sm flex items-center gap-1 font-black text-xs"
                        >
                          <RotateCcw size={13} />
                          <span>استرجاع</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(backup)}
                          title="حذف هذه النسخة"
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors shadow-sm"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && backups.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-gray-400 font-bold text-sm">
                    لا توجد نسخ احتياطية مسجلة بعد — يمكنك إنشاء أول نسخة الآن من الأعلى.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs font-bold text-slate-600 gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-[#007507] flex-shrink-0" />
            <span>المكان الفعلي لمجلد النسخ الاحتياطية على السيرفر:</span>
            <span className="font-mono text-slate-900 font-black bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-sm" dir="ltr">
              {stats.backupDir || 'D:\\كانتين\\CanteenSystem\\backend\\backups'}
            </span>
          </div>
          <button 
            onClick={handleCopyFolderLocation}
            className="flex items-center gap-1.5 text-[#007507] hover:text-[#003607] bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-300 font-black transition-colors cursor-pointer shadow-sm"
            title="نسخ مسار مجلد النسخ الاحتياطية إلى الحافظة"
          >
            <Copy size={14} />
            <span>نسخ مسار المجلد</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      {selectedForRestore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <span className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                <AlertTriangle size={24} />
              </span>
              <div>
                <h3 className="text-xl font-black text-gray-900">تأكيد استرجاع قاعدة البيانات</h3>
                <p className="text-xs font-bold text-rose-600 mt-0.5">عملية استرجاع كبرى لحالة سابقة</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs font-bold text-gray-700">
              <p className="flex justify-between">
                <span className="text-gray-400">اسم النسخة المسترجعة:</span>
                <span className="font-mono text-gray-900 font-black">{selectedForRestore.filename}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-400">توقيت أخذ النسخة:</span>
                <span className="font-mono text-gray-900">{formatDateTime(selectedForRestore.createdAt)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-400">الحجم:</span>
                <span className="font-mono text-gray-900">{selectedForRestore.sizeFormatted}</span>
              </p>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-900 flex items-start gap-2">
              <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>حماية مشددة:</strong> سيتم حفظ نسخة أمان تلقائية إجبارية من البيانات الحالية فوراً قبل الاسترجاع، بحيث تستطيع العودة في أي وقت.
              </span>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5">
                لتأكيد العملية، يرجى كتابة كلمة <span className="text-rose-600 underline font-black">استرجاع</span> في الخانة أدناه:
              </label>
              <input 
                type="text" 
                placeholder="اكتب استرجاع للتأكيد..."
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-xs font-black outline-none focus:border-rose-600 text-center bg-gray-50/50"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedForRestore(null)}
                disabled={restoring}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-xs transition-colors"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={confirmText.trim() !== 'استرجاع' || restoring}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {restoring ? (
                  <>
                    <RotateCcw size={15} className="animate-spin" />
                    <span>جاري الاسترجاع...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} />
                    <span>تأكيد الاسترجاع الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;
