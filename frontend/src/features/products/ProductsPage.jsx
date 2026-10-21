import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Sparkles, Edit3, X, Barcode, Package, CheckCircle2, 
  Search, SlidersHorizontal, AlertTriangle, Clock, Calendar, Filter
} from 'lucide-react';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED'
  const { hasPermission } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '', 
    internalCode: '', 
    barcode: '', 
    sellingPrice: '', 
    purchasePrice: '', 
    unit: 'قطعة', 
    packageUnit: '', 
    piecesPerPackage: 1, 
    conversionFactor: 1, 
    alertThreshold: 10, 
    expiryDate: '',
    isActive: true
  });

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: null, quantity: '', type: 'IN', reason: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await client.get('/products');
      setProducts(res.data.data);
    } catch (err) {
      setError('فشل جلب الأصناف');
    } finally {
      setLoading(false);
    }
  };

  // Counts for tabs
  const lowStockCount = products.filter(p => Number(p.totalStock) <= Number(p.alertThreshold) || Number(p.totalStock) <= 0).length;
  const expiringSoonCount = products.filter(p => p.isExpiringSoon).length;
  const expiredCount = products.filter(p => p.isExpired).length;

  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.internalCode && p.internalCode.toLowerCase().includes(q)) || 
      (p.barcode && p.barcode.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (filterTab === 'LOW_STOCK') {
      return Number(p.totalStock) <= Number(p.alertThreshold) || Number(p.totalStock) <= 0;
    }
    if (filterTab === 'EXPIRING_SOON') {
      return p.isExpiringSoon;
    }
    if (filterTab === 'EXPIRED') {
      return p.isExpired;
    }

    return true;
  });

  const openAddModal = () => {
    setIsEditMode(false);
    const autoCode = `PROD-${Date.now().toString().slice(-5)}`;
    setForm({ 
      name: '', 
      internalCode: autoCode, 
      barcode: '', 
      sellingPrice: '', 
      purchasePrice: '', 
      unit: 'قطعة', 
      packageUnit: '', 
      piecesPerPackage: 1, 
      conversionFactor: 1, 
      alertThreshold: 10, 
      expiryDate: '',
      isActive: true 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setIsEditMode(true);
    setCurrentId(product.id);
    
    let formattedExpiry = '';
    if (product.expiryDate) {
      formattedExpiry = String(product.expiryDate).split('T')[0];
    } else if (product.effectiveExpiryDate) {
      formattedExpiry = String(product.effectiveExpiryDate).split('T')[0];
    }

    setForm({
      name: product.name,
      internalCode: product.internalCode,
      barcode: product.barcode || '',
      sellingPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice,
      unit: product.unit || 'قطعة',
      packageUnit: product.packageUnit || '',
      piecesPerPackage: product.piecesPerPackage || 1,
      conversionFactor: product.conversionFactor || 1,
      alertThreshold: product.alertThreshold ?? 10,
      expiryDate: formattedExpiry,
      isActive: product.isActive
    });
    setIsModalOpen(true);
  };

  const openAdjustModal = (product) => {
    setAdjustForm({ productId: product.id, quantity: '', type: 'IN', reason: '' });
    setAdjustModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.purchasePrice || !form.sellingPrice) {
      return toast.error('يرجى ملء جميع الحقول الإلزامية للصنف');
    }
    setIsSaving(true);
    try {
      if (isEditMode) {
        await client.put(`/products/${currentId}`, form);
        toast.success('تم تحديث بيانات الصنف وتاريخ الصلاحية بنجاح ✅');
      } else {
        await client.post('/products', form);
        toast.success('تمت إضافة الصنف الجديد بنجاح ✅');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الصنف');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/products/${adjustForm.productId}/adjust`, {
        quantity: adjustForm.quantity,
        type: adjustForm.type,
        reason: adjustForm.reason
      });
      toast.success('تمت تسوية المخزون بنجاح');
      setAdjustModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في تسوية المخزون');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">جاري تحميل الأصناف والمخزون...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">إدارة الأصناف والمخزون</h2>
          <p className="text-gray-500 text-sm font-bold mt-1">متابعة الأصناف، الأسعار، تواريخ الصلاحية، والكميات المتوفرة</p>
        </div>
        {hasPermission('MANAGE_PRODUCTS') && (
          <button 
            onClick={openAddModal} 
            className="bg-indigo-600 text-white font-black px-6 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
          >
            <Sparkles size={20} />
            <span>+ إضافة صنف جديد</span>
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-xl font-bold">{error}</div>}

      {/* Expiry & Low Stock Quick Notification Banner */}
      {(expiringSoonCount > 0 || expiredCount > 0) && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle size={24} className="text-white" />
            </span>
            <div>
              <h4 className="font-black text-sm sm:text-base">تنبيه تواريخ الصلاحية والتوالف ⚠️</h4>
              <p className="text-amber-100 text-xs font-bold">
                يوجد {expiredCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded font-black text-white">{expiredCount} صنف منتهي الصلاحية</span>}
                {expiredCount > 0 && expiringSoonCount > 0 && ' و '}
                {expiringSoonCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded font-black text-white">{expiringSoonCount} صنف أوشك على الانتهاء خلال 30 يوم</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <button 
                onClick={() => setFilterTab('EXPIRED')}
                className="bg-white text-rose-700 hover:bg-rose-50 font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
              >
                عرض المنتهي ({expiredCount})
              </button>
            )}
            {expiringSoonCount > 0 && (
              <button 
                onClick={() => setFilterTab('EXPIRING_SOON')}
                className="bg-white text-amber-800 hover:bg-amber-50 font-black px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-sm"
              >
                عرض وشيك الانتهاء ({expiringSoonCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Products Table Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 space-y-5">
        
        {/* Tabs Filter & Search Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between border-b border-gray-100 pb-4">
          
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>جميع الأصناف</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'ALL' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {products.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('LOW_STOCK')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'LOW_STOCK'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={14} />
              <span>نواقص المخزون</span>
              {lowStockCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'LOW_STOCK' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab('EXPIRING_SOON')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'EXPIRING_SOON'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-200'
                  : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
              }`}
            >
              <Clock size={14} />
              <span>أوشكت الصلاحية (خلال 30 يوم)</span>
              {expiringSoonCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'EXPIRING_SOON' ? 'bg-white/25 text-white' : 'bg-orange-200 text-orange-900'}`}>
                  {expiringSoonCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab('EXPIRED')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                filterTab === 'EXPIRED'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle size={14} />
              <span>منتهية الصلاحية</span>
              {expiredCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${filterTab === 'EXPIRED' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'}`}>
                  {expiredCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بالاسم، الكود، أو الباركود..." 
              className="w-full border-2 border-gray-200 rounded-xl pr-10 pl-4 py-2 outline-none focus:border-indigo-600 transition-all font-bold text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

        </div>

        {/* Products Table */}
        <div className="overflow-x-auto rounded-2xl border-2 border-gray-100">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead className="bg-gray-50/80 text-gray-700 text-xs font-black">
              <tr>
                <th className="p-3.5 border-b">الكود</th>
                <th className="p-3.5 border-b">اسم الصنف والباركود</th>
                <th className="p-3.5 border-b">سعر الشراء</th>
                <th className="p-3.5 border-b">سعر البيع</th>
                <th className="p-3.5 border-b">المخزون الحالي</th>
                <th className="p-3.5 border-b">حالة المخزون</th>
                <th className="p-3.5 border-b">تاريخ الصلاحية</th>
                <th className="p-3.5 border-b text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 divide-y divide-gray-100 font-bold">
              {filteredProducts.map(p => (
                <tr key={p.id} className={`hover:bg-indigo-50/30 transition-colors ${!p.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                  <td className="p-3.5 font-mono text-gray-600">{p.internalCode}</td>
                  
                  <td className="p-3.5">
                    <div className="font-black text-gray-900 text-sm">{p.name}</div>
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                      <Barcode size={13} className="text-gray-400" />
                      <span>{p.barcode || 'بدون باركود'}</span>
                    </div>
                  </td>

                  <td className="p-3.5 text-gray-700 font-mono">{Number(p.purchasePrice || 0).toFixed(2)} ج.م</td>
                  <td className="p-3.5 font-black text-emerald-600 font-mono">{Number(p.sellingPrice || 0).toFixed(2)} ج.م</td>
                  
                  <td className="p-3.5">
                    <span className="text-base text-gray-900 font-black">{p.totalStock}</span>{' '}
                    <span className="text-xs font-normal text-gray-500">{p.unit || 'قطعة'}</span>
                  </td>

                  <td className="p-3.5">
                    {p.totalStock < 0 ? (
                      <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-black border border-red-200">سالب ({p.totalStock})</span>
                    ) : p.totalStock === 0 ? (
                      <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-black border border-red-200">نفد من المخزون</span>
                    ) : p.totalStock <= p.alertThreshold ? (
                      <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-black border border-amber-200">أوشك على الانتهاء</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-black border border-emerald-200">متوفر</span>
                    )}
                  </td>

                  {/* Expiry Date Column */}
                  <td className="p-3.5">
                    {p.effectiveExpiryDate ? (
                      <div className="space-y-1">
                        <div className="font-mono text-xs font-black text-gray-800 flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{new Date(p.effectiveExpiryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                        </div>
                        <div>
                          {p.isExpired ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-black border border-red-200 inline-flex items-center gap-1">
                              <AlertTriangle size={11} /> منتهي ({Math.abs(p.daysUntilExpiry)} يوم مضت)
                            </span>
                          ) : p.isExpiringSoon ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-black border border-amber-200 inline-flex items-center gap-1">
                              <Clock size={11} /> قرب ينتهي (متبقي {p.daysUntilExpiry} يوم)
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold border border-emerald-200">
                              صالح (متبقي {p.daysUntilExpiry} يوم)
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs font-bold bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">غير محدد</span>
                    )}
                  </td>

                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {hasPermission('MANAGE_PRODUCTS') && (
                        <button 
                          onClick={() => openEditModal(p)} 
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                        >
                          <Edit3 size={13} />
                          تعديل
                        </button>
                      )}
                      {hasPermission('MANAGE_INVENTORY') && (
                        <button 
                          onClick={() => openAdjustModal(p)} 
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors"
                        >
                          <SlidersHorizontal size={13} />
                          تسوية
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-gray-400 font-bold">
                    لا توجد أصناف مطابقة للبحث أو الفلتر المحدد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Product Modal (Add / Edit) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-lg border border-gray-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Edit3 className="text-amber-600" size={24} />
                    <span>تعديل بيانات الصنف وتاريخ الصلاحية</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="text-indigo-600" size={24} />
                    <span>إضافة صنف جديد لمنظومة الكانتين</span>
                  </>
                )}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">
                  اسم الصنف <span className="text-red-500">*</span>:
                </label>
                <input 
                  required
                  autoFocus
                  type="text" 
                  placeholder="مثال: بسكويت أوريو 6 قطع"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Barcode & Internal Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الباركود:</label>
                  <input 
                    type="text" 
                    placeholder="امسح أو اكتب الباركود"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800 font-mono"
                    value={form.barcode}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">
                    الكود الداخلي <span className="text-red-500">*</span>:
                  </label>
                  <input 
                    required
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800 font-mono"
                    value={form.internalCode}
                    onChange={e => setForm({ ...form, internalCode: e.target.value })}
                  />
                </div>
              </div>

              {/* Purchase & Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">
                    سعر الشراء (ج.م) <span className="text-red-500">*</span>:
                  </label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-black text-indigo-700 text-base"
                    value={form.purchasePrice}
                    onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">
                    سعر البيع للمريض (ج.م) <span className="text-red-500">*</span>:
                  </label>
                  <input 
                    required
                    type="number" 
                    step="0.01" 
                    min="0"
                    placeholder="0.00"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-black text-emerald-600 text-base"
                    value={form.sellingPrice}
                    onChange={e => setForm({ ...form, sellingPrice: e.target.value })}
                  />
                </div>
              </div>

              {/* Unit & Alert Threshold */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">الوحدة الأساسية:</label>
                  <input 
                    type="text" 
                    placeholder="قطعة / كيس / زجاجة"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-bold text-gray-700">حد التنبيه للنقص:</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="10"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-600 font-bold text-gray-800"
                    value={form.alertThreshold}
                    onChange={e => setForm({ ...form, alertThreshold: e.target.value })}
                  />
                </div>
              </div>

              {/* ================= NEW EXPIRY DATE FIELD (OPTIONAL) ================= */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border-2 border-amber-100 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <Calendar size={15} className="text-amber-600" />
                    <span>تاريخ انتهاء الصلاحية:</span>
                  </label>
                  <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                    اختياري
                  </span>
                </div>
                <input 
                  type="date"
                  className="w-full border-2 border-amber-200 rounded-xl p-2.5 outline-none focus:border-amber-500 font-bold text-gray-800 bg-white"
                  value={form.expiryDate}
                  onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                />
                <p className="text-[11px] text-amber-700/80 font-bold">
                  اتركه فارغاً إذا كان الصنف غير قابل لانتهاء الصلاحية، أو حدد تاريخ الانتهاء ليظهر تنبيه عند اقترابه.
                </p>
              </div>

              {/* Active Toggle in Edit Mode */}
              {isEditMode && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={form.isActive} 
                    onChange={e => setForm({ ...form, isActive: e.target.checked })} 
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  />
                  <label htmlFor="isActive" className="font-bold text-gray-700 cursor-pointer text-sm">
                    الصنف نشط (يظهر في شاشة البيع POS)
                  </label>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'جاري الحفظ...' : isEditMode ? 'تحديث الصنف' : 'حفظ الصنف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm border border-gray-100">
            <h3 className="text-xl font-black mb-5 text-gray-800 border-b border-gray-100 pb-3 flex items-center gap-2">
              <SlidersHorizontal className="text-purple-600" size={22} />
              <span>تسوية المخزون</span>
            </h3>
            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">نوع الحركة:</label>
                <select 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-bold bg-white" 
                  value={adjustForm.type} 
                  onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })}
                >
                  <option value="IN">إضافة للمخزون (+)</option>
                  <option value="OUT">خصم من المخزون (-)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">الكمية:</label>
                <input 
                  required 
                  type="number" 
                  min="0.01" 
                  step="0.01" 
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-black text-purple-700" 
                  value={adjustForm.quantity} 
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">سبب التسوية:</label>
                <input 
                  type="text" 
                  placeholder="مثال: جرد يدوي / تالف / هدية"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-600 font-bold text-gray-800" 
                  value={adjustForm.reason} 
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setAdjustModal(false)} 
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 transition-colors shadow-md shadow-purple-200"
                >
                  تأكيد التسوية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductsPage;
