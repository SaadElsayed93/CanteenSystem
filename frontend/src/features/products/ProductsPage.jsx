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
    name: '', internalCode: '', barcode: '', sellingPrice: '', purchasePrice: '', unit: '', conversionFactor: 1, alertThreshold: 0, isActive: true
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
    setForm({ name: '', internalCode: '', barcode: '', sellingPrice: '', purchasePrice: '', unit: '', conversionFactor: 1, alertThreshold: 0, isActive: true });
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
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">إدارة الأصناف والمخزون</h2>
        {hasPermission('MANAGE_PRODUCTS') && (
          <button onClick={openAddModal} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
            + إضافة صنف جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg font-bold">{error}</div>}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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

        <div className="overflow-x-auto rounded-xl border border-gray-100">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditMode ? 'تعديل الصنف' : 'إضافة صنف جديد'}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block mb-1">اسم الصنف</label><input required type="text" className="w-full border rounded p-2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div><label className="block mb-1">الكود الداخلي</label><input required type="text" className="w-full border rounded p-2" value={form.internalCode} onChange={e=>setForm({...form,internalCode:e.target.value})}/></div>
              <div><label className="block mb-1">الباركود (اختياري)</label><input type="text" className="w-full border rounded p-2" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></div>
              <div><label className="block mb-1">سعر الشراء</label><input required type="number" step="0.01" className="w-full border rounded p-2" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})}/></div>
              <div><label className="block mb-1">سعر البيع</label><input required type="number" step="0.01" className="w-full border rounded p-2" value={form.sellingPrice} onChange={e=>setForm({...form,sellingPrice:e.target.value})}/></div>
              <div><label className="block mb-1">الوحدة (مثل: قطعة، كرتونة)</label><input required type="text" className="w-full border rounded p-2" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
              <div><label className="block mb-1">الحد الأدنى للتنبيه</label><input required type="number" className="w-full border rounded p-2" value={form.alertThreshold} onChange={e=>setForm({...form,alertThreshold:e.target.value})}/></div>
              
              {isEditMode && (
                <div className="md:col-span-2 flex items-center gap-2 mt-4">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="isActive">الصنف نشط (يظهر في المبيعات)</label>
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Inventory Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">تسوية المخزون (إدخال/إخراج يدوي)</h3>
            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1">نوع الحركة</label>
                <select className="w-full border rounded p-2" value={adjustForm.type} onChange={e=>setAdjustForm({...adjustForm, type: e.target.value})}>
                  <option value="IN">إضافة للمخزون (+)</option>
                  <option value="OUT">خصم من المخزون (-)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1">الكمية</label>
                <input required type="number" min="0.01" step="0.01" className="w-full border rounded p-2" value={adjustForm.quantity} onChange={e=>setAdjustForm({...adjustForm, quantity: e.target.value})}/>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setAdjustModal(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">تأكيد التسوية</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductsPage;
