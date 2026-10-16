import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  Sparkles, Edit3, X, Barcode, Package, CheckCircle2, 
  Search, SlidersHorizontal, AlertTriangle 
} from 'lucide-react';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
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

  const filteredProducts = products.filter(p => 
    p.name.includes(search) || 
    p.internalCode.includes(search) || 
    (p.barcode && p.barcode.includes(search))
  );

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
      isActive: true 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setIsEditMode(true);
    setCurrentId(product.id);
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
        toast.success('تم تحديث بيانات الصنف بنجاح');
      } else {
        await client.post('/products', form);
        toast.success('تمت إضافة الصنف بنجاح');
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
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة الأصناف والمخزون</h2>
          <p className="text-gray-500 text-sm mt-1">متابعة الأصناف، الأسعار، الباركود، والكميات المتوفرة</p>
        </div>
        {hasPermission('MANAGE_PRODUCTS') && (
          <button 
            onClick={openAddModal} 
            className="bg-indigo-600 text-white font-black px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
          >
            <Sparkles size={20} />
            <span>+ إضافة صنف جديد</span>
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg font-bold">{error}</div>}

      {/* Products Table Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-1/3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث بالاسم، الكود، أو الباركود..." 
              className="w-full border-2 border-gray-200 rounded-xl pr-10 pl-4 py-2.5 outline-none focus:border-indigo-600 transition-all font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="text-sm font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            إجمالي الأصناف: <span className="text-indigo-600 font-black">{filteredProducts.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">الكود</th>
                <th className="p-4 border-b font-bold">اسم الصنف والباركود</th>
                <th className="p-4 border-b font-bold">سعر الشراء</th>
                <th className="p-4 border-b font-bold">سعر البيع</th>
                <th className="p-4 border-b font-bold">المخزون الحالي</th>
                <th className="p-4 border-b font-bold">حالة المخزون</th>
                <th className="p-4 border-b font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {filteredProducts.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                  <td className="p-4 border-b font-mono font-bold text-gray-600">{p.internalCode}</td>
                  <td className="p-4 border-b">
                    <div className="font-bold text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                      <Barcode size={14} className="text-gray-400" />
                      <span>{p.barcode || 'بدون باركود'}</span>
                    </div>
                  </td>
                  <td className="p-4 border-b font-bold text-gray-700">{p.purchasePrice} ج.م</td>
                  <td className="p-4 border-b font-black text-emerald-600">{p.sellingPrice} ج.م</td>
                  <td className="p-4 border-b font-bold">
                    <span className="text-base text-gray-800">{p.totalStock}</span>{' '}
                    <span className="text-xs font-normal text-gray-500">{p.unit || 'قطعة'}</span>
                  </td>
                  <td className="p-4 border-b">
                    {p.totalStock < 0 ? (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">سالب ({p.totalStock})</span>
                    ) : p.totalStock === 0 ? (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">انتهى من المخزون</span>
                    ) : p.totalStock <= p.alertThreshold ? (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200">أوشك على الانتهاء</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">متوفر</span>
                    )}
                  </td>
                  <td className="p-4 border-b">
                    <div className="flex gap-2">
                      {hasPermission('MANAGE_PRODUCTS') && (
                        <button 
                          onClick={() => openEditModal(p)} 
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <Edit3 size={14} />
                          تعديل
                        </button>
                      )}
                      {hasPermission('MANAGE_INVENTORY') && (
                        <button 
                          onClick={() => openAdjustModal(p)} 
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <SlidersHorizontal size={14} />
                          تسوية
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400 font-bold">لا توجد أصناف مطابقة للبحث</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Product Modal (Same as Purchases Card) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-lg border border-gray-100">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Edit3 className="text-amber-600" size={24} />
                    <span>تعديل بيانات الصنف والباركود</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="text-indigo-600" size={24} />
                    <span>إضافة صنف جديد بالباركود</span>
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
