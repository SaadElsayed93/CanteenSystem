import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Database, ShieldCheck, HardDrive, Download, Upload, RotateCcw, 
  Trash2, AlertTriangle, CheckCircle2, Clock, FileCheck, Save, 
  RefreshCw, FolderOpen, Lock, ShieldAlert
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
  'MANUAL': { label: 'يدوي بطلب المدير', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'AUTO': { label: 'تلقائي مجدول (03:00 ص)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'SHIFT_CLOSE': { label: 'تقفيل وردية ويومية', color: 'bg-violet-100 text-violet-800 border-violet-200' },
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
    externalPath: ''
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupNotes, setBackupNotes] = useState('');
  
  // External Path State
  const [externalPath, setExternalPath] = useState('');
  const [savingPath, setSavingPath] = useState(false);

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
        setStats(res.data.data.stats || {});
        setExternalPath(res.data.data.stats.externalPath || '');
      }
    } catch (err) {
      console.error(err);
      toast.error('تعذر جلب سجل النسخ الاحتياطية');
    } finally {
      setLoading(false);
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

  const handleOpenFolder = async () => {
    try {
      const res = await client.post('/backups/open-folder');
      if (res.data?.success) {
        toast.success('تم إرسال أمر فتح المجلد لويندوز 📂\n(يمكنك أيضاً الضغط على اختصار Canteen_Backups على سطح المكتب)');
        if (res.data.path && navigator.clipboard) {
          navigator.clipboard.writeText(res.data.path).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'تعذر فتح المجلد');
    }
  };

  const handleOpenFileLocation = async (backup) => {
    try {
      const res = await client.post(`/backups/${backup.id}/open-location`);
      if (res.data?.success) {
        toast.success(`تم فتح مكان الملف وتحديده في ويندوز 📂\n${backup.filename}`);
        if (res.data.path && navigator.clipboard) {
          navigator.clipboard.writeText(res.data.path).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'تعذر فتح مكان الملف');
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
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-emerald-400">
              <ShieldCheck size={28} />
            </span>
            <div>
              <h1 className="text-2xl font-black">مركز النسخ الاحتياطي وإدارة الأمان</h1>
              <p className="text-indigo-200 text-xs font-bold mt-0.5">
                حماية شاملة لقاعدة بيانات الكانتين ضد أي أعطال أو انقطاع للكهرباء مع إمكانية الاسترداد الفوري
              </p>
            </div>
          </div>
        </div>

        <div className="z-10 flex flex-wrap items-center gap-2.5">
          <button 
            onClick={handleOpenFolder}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
            title="فتح مجلد النسخ الاحتياطية في مستعرض ملفات ويندوز"
          >
            <FolderOpen size={16} />
            <span>فتح مجلد النسخ في الجهاز</span>
          </button>

          <button 
            onClick={fetchBackups} 
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm"
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
              <h3 className="text-lg font-black text-emerald-600 mt-1">قاعدة البيانات مؤمنة</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
            جاهزية الاسترداد والنسخ الحي 100%
          </div>
        </div>

        {/* Card 2: Last Backup */}
        <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">توقيت آخر نسخة مسجلة</p>
              <h3 className="text-sm font-black text-gray-800 mt-1 truncate" title={formatDateTime(stats.lastBackupTime)}>
                {stats.lastBackupTime ? formatDateTime(stats.lastBackupTime) : 'لا توجد نسخ بعد'}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-indigo-700 bg-indigo-50/80 p-2 rounded-lg border border-indigo-100">
            نسخ تلقائي مجدول عند التقفيل و03:00 ص
          </div>
        </div>

        {/* Card 3: Total Archive */}
        <div className="bg-white p-5 rounded-2xl border-2 border-purple-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">إجمالي أرشيف النسخ</p>
              <h3 className="text-xl font-black text-purple-700 mt-1">
                {stats.totalCount} <span className="text-xs font-bold text-gray-500">نسخة محفوظة</span>
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Database size={22} />
            </div>
          </div>
          <div className="text-xs font-bold text-purple-700 bg-purple-50/80 p-2 rounded-lg border border-purple-100">
            المساحة المستهلكة: {stats.totalSizeFormatted}
          </div>
        </div>

        {/* Card 4: External USB Path */}
        <div className="bg-white p-5 rounded-2xl border-2 border-amber-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-400 font-bold text-xs">النسخ الخارجي (فلاشة USB)</p>
              <h3 className="text-sm font-black text-gray-800 mt-1 truncate" title={stats.externalPath || 'غير مفعل'}>
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

      {/* Main Action Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Create Backup Now & USB Setup */}
        <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
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
                className="w-full border-2 border-gray-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-indigo-600 bg-gray-50/50"
              />
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
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
                className="flex-1 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-indigo-600 bg-gray-50/50"
                dir="ltr"
              />
              <button
                onClick={handleSaveExternalPath}
                disabled={savingPath}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
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
              <FolderOpen size={36} className="text-indigo-400 mb-2" />
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
                className="px-4 py-2 bg-white border-2 border-gray-200 hover:border-indigo-600 rounded-xl text-xs font-black text-gray-700 cursor-pointer shadow-sm hover:text-indigo-600 transition-colors"
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
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
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
              <Database size={20} className="text-indigo-600" />
              <span>سجل وأرشيف النسخ الاحتياطية</span>
            </h3>
            <p className="text-gray-400 font-bold text-xs mt-0.5">
              كافة النسخ المحفوظة على السيرفر مصنفة حسب التوقيت والنوع مع خيارات التحميل والاسترجاع الفوري
            </p>
          </div>
          <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200">
            {backups.length} نسخة محفوظة
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
                  <tr key={backup.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-indigo-500 flex-shrink-0" />
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
                        {/* Open File Location in Windows Explorer */}
                        <button
                          onClick={() => handleOpenFileLocation(backup)}
                          title="فتح وتحديد مكان ملف النسخة في ويندوز"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-colors shadow-sm"
                        >
                          <FolderOpen size={15} />
                        </button>

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(backup)}
                          disabled={downloadingId === backup.id}
                          title="تنزيل النسخة إلى جهازك أو فلاشة"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                        >
                          {downloadingId === backup.id ? (
                            <RotateCcw size={15} className="animate-spin text-indigo-600" />
                          ) : (
                            <Download size={15} />
                          )}
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

        <div className="bg-gray-50/80 p-3.5 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center text-xs font-bold text-gray-500 gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <FolderOpen size={15} className="text-emerald-600 flex-shrink-0" />
              <span>المسار الأصلي لمجلد النسخ:</span>
              <span className="font-mono text-gray-800 font-black bg-white px-2 py-0.5 rounded border border-gray-200" dir="ltr">D:\كانتين\CanteenSystem\backend\backups</span>
            </div>
            <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mr-2">
              💡 تم وضع اختصار مباشر (Canteen_Backups) على سطح مكتب جهازك
            </span>
          </div>
          <button 
            onClick={handleOpenFolder}
            className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 font-black transition-colors"
          >
            فتح المجلد في ويندوز 📂
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
