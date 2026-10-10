import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { hasPermission } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [form, setForm] = useState({
    name: '', internalCode: '', barcode: '', sellingPrice: '', purchasePrice: '', unit: '', packageUnit: '', piecesPerPackage: 1, conversionFactor: 1, alertThreshold: 0, isActive: true
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
    setForm({ name: '', internalCode: '', barcode: '', sellingPrice: '', purchasePrice: '', unit: '', packageUnit: '', piecesPerPackage: 1, conversionFactor: 1, alertThreshold: 0, isActive: true });
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
      unit: product.unit,
      packageUnit: product.packageUnit || '',
      piecesPerPackage: product.piecesPerPackage || 1,
      conversionFactor: product.conversionFactor,
      alertThreshold: product.alertThreshold,
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
    try {
      if (isEditMode) {
        await client.put(`/products/${currentId}`, form);
      } else {
        await client.post('/products', form);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
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
      setAdjustModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">إدارة الأصناف والمخزون</h2>
        {hasPermission('MANAGE_PRODUCTS') && (
          <button onClick={openAddModal} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
            + إضافة صنف جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg font-bold">{error}</div>}

      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <input 
            type="text" 
            placeholder="بحث بالاسم، الكود، أو الباركود..." 
            className="w-full md:w-1/3 border border-gray-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="text-sm font-bold text-gray-500">
            إجمالي الأصناف: {filteredProducts.length}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">الكود</th>
                <th className="p-4 border-b font-bold">اسم الصنف</th>
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
                  <td className="p-4 border-b">{p.internalCode}</td>
                  <td className="p-4 border-b font-bold text-gray-800">{p.name} <br/><span className="text-xs text-gray-400 font-normal">{p.barcode || '-'}</span></td>
                  <td className="p-4 border-b">{p.purchasePrice}</td>
                  <td className="p-4 border-b font-bold text-indigo-600">{p.sellingPrice}</td>
                  <td className="p-4 border-b font-bold">{p.totalStock} <span className="text-sm font-normal text-gray-400">{p.unit}</span></td>
                  <td className="p-4 border-b">
                    {p.totalStock < 0 ? (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">سالب ({p.totalStock})</span>
                    ) : p.totalStock === 0 ? (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">انتهى من المخزون</span>
                    ) : p.totalStock <= p.alertThreshold ? (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm border border-yellow-200">أوشك على الانتهاء</span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm border border-green-200">متوفر</span>
                    )}
                  </td>
                  <td className="p-4 border-b">
                    <div className="flex gap-3">
                      {hasPermission('MANAGE_PRODUCTS') && (
                        <button onClick={() => openEditModal(p)} className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-all">تعديل</button>
                      )}
                      {hasPermission('MANAGE_INVENTORY') && (
                        <button onClick={() => openAdjustModal(p)} className="text-purple-600 hover:text-purple-800 font-bold hover:underline transition-all">تسوية</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">لا توجد أصناف مطابقة للبحث</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">{isEditMode ? '✏️ تعديل الصنف' : '📦 إضافة صنف جديد'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">اسم الصنف</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الكود الداخلي</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.internalCode} onChange={e=>setForm({...form,internalCode:e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الباركود (اختياري)</label>
                <input type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">سعر الشراء</label>
                <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">سعر البيع</label>
                <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-indigo-700" value={form.sellingPrice} onChange={e=>setForm({...form,sellingPrice:e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الوحدة الأساسية (مثل: قطعة، كيس)</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-bold text-indigo-900 text-sm">وحدة التعبئة / الكرتونة (اختياري)</label>
                  <input type="text" placeholder="مثل: كرتونة، باكتة" className="w-full border border-indigo-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.packageUnit} onChange={e=>setForm({...form,packageUnit:e.target.value})}/>
                </div>
                <div>
                  <label className="block mb-2 font-bold text-indigo-900 text-sm">الكمية داخل {form.packageUnit || 'الكرتونة'} (بالوحدة الأساسية)</label>
                  <input type="number" min="1" className="w-full border border-indigo-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.piecesPerPackage} onChange={e=>setForm({...form,piecesPerPackage:e.target.value})} disabled={!form.packageUnit}/>
                </div>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الحد الأدنى للتنبيه</label>
                <input required type="number" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.alertThreshold} onChange={e=>setForm({...form,alertThreshold:e.target.value})}/>
              </div>
              
              {isEditMode && (
                <div className="md:col-span-2 flex items-center gap-3 mt-4 bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="isActive" className="font-bold text-gray-700 cursor-pointer">الصنف نشط (يظهر في المبيعات)</label>
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">حفظ الصنف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">⚖️ تسوية المخزون</h3>
            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">نوع الحركة</label>
                <select className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={adjustForm.type} onChange={e=>setAdjustForm({...adjustForm, type: e.target.value})}>
                  <option value="IN">إضافة للمخزون (+)</option>
                  <option value="OUT">خصم من المخزون (-)</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الكمية</label>
                <input required type="number" min="0.01" step="0.01" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={adjustForm.quantity} onChange={e=>setAdjustForm({...adjustForm, quantity: e.target.value})}/>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setAdjustModal(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">تأكيد التسوية</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductsPage;
