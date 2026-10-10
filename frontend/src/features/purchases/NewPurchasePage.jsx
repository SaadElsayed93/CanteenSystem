import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useNavigate } from 'react-router-dom';

const NewPurchasePage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [form, setForm] = useState({ supplierId: '', referenceNo: '' });
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({ productId: '', quantity: '', unitCost: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppRes, prodRes] = await Promise.all([
        client.get('/purchases/suppliers'),
        client.get('/products')
      ]);
      setSuppliers(suppRes.data.data.filter(s => s.isActive));
      setProducts(prodRes.data.data.filter(p => p.isActive));
    } catch (err) {
      alert('فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!currentItem.productId || !currentItem.quantity || !currentItem.unitCost) return;
    
    const product = products.find(p => p.id === Number(currentItem.productId));
    setItems([...items, { ...currentItem, productId: Number(currentItem.productId), productName: product.name }]);
    setCurrentItem({ productId: '', quantity: '', unitCost: '' });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async () => {
    if (!form.supplierId) return alert('اختر المورد');
    if (items.length === 0) return alert('أضف أصناف للفاتورة');

    try {
      await client.post('/purchases', {
        supplierId: Number(form.supplierId),
        referenceNo: form.referenceNo || `PUR-${Date.now()}`,
        items: items.map(i => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost) }))
      });
      alert('تم حفظ الفاتورة وإضافة المخزون بنجاح');
      navigate('/purchases/suppliers');
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة');
    }
  };

  const totalInvoice = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost)), 0);

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">فاتورة مشتريات جديدة</h2>

      <div className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1">المورد</label>
          <select className="w-full border rounded p-2" value={form.supplierId} onChange={e=>setForm({...form, supplierId: e.target.value})}>
            <option value="">اختر المورد...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1">رقم الفاتورة (المرجعي)</label>
          <input type="text" placeholder="اختياري (سيتولد تلقائياً إذا تُرك فارغاً)" className="w-full border rounded p-2" value={form.referenceNo} onChange={e=>setForm({...form, referenceNo: e.target.value})}/>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded border mb-6">
        <h3 className="font-bold mb-4">إضافة صنف للفاتورة</h3>
        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block mb-1 text-sm">الصنف</label>
            <select required className="w-full border rounded p-2" value={currentItem.productId} onChange={e=> {
              const pid = e.target.value;
              const prod = products.find(p => p.id === Number(pid));
              setCurrentItem({...currentItem, productId: pid, unitCost: prod ? prod.purchasePrice : ''});
            }}>
              <option value="">اختر...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm">الكمية المستلمة</label>
            <input required type="number" min="0.01" step="0.01" className="w-full border rounded p-2" value={currentItem.quantity} onChange={e=>setCurrentItem({...currentItem, quantity: e.target.value})}/>
          </div>
          <div>
            <label className="block mb-1 text-sm">سعر الشراء للوحدة</label>
            <input required type="number" min="0.01" step="0.01" className="w-full border rounded p-2" value={currentItem.unitCost} onChange={e=>setCurrentItem({...currentItem, unitCost: e.target.value})}/>
          </div>
          <div>
            <button type="submit" className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700">إضافة</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto mb-6">
        <table className="w-full text-right border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border-b">الصنف</th>
              <th className="p-3 border-b">الكمية</th>
              <th className="p-3 border-b">السعر</th>
              <th className="p-3 border-b">الإجمالي</th>
              <th className="p-3 border-b"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="p-3 border-b">{item.productName}</td>
                <td className="p-3 border-b">{item.quantity}</td>
                <td className="p-3 border-b">{item.unitCost}</td>
                <td className="p-3 border-b">{(Number(item.quantity) * Number(item.unitCost)).toFixed(2)}</td>
                <td className="p-3 border-b">
                  <button onClick={() => removeItem(idx)} className="text-red-600 hover:underline">حذف</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">لم يتم إضافة أصناف</td></tr>}
          </tbody>
          <tfoot className="bg-gray-50 font-bold text-lg">
            <tr>
              <td colSpan="3" className="p-3 text-left">إجمالي الفاتورة:</td>
              <td colSpan="2" className="p-3 text-blue-600">{totalInvoice.toFixed(2)} جنية</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSavePurchase} className="bg-green-600 text-white px-8 py-3 rounded text-lg hover:bg-green-700 shadow">
          تأكيد وحفظ الفاتورة
        </button>
      </div>
    </div>
  );
};

export default NewPurchasePage;
