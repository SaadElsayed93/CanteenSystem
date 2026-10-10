import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useNavigate } from 'react-router-dom';

const NewPurchasePage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({ supplierId: '', referenceNo: '' });
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [items, setItems] = useState([]);
  
  // Package logic added: user can choose package or base unit
  const [currentItem, setCurrentItem] = useState({ 
    productId: '', 
    buyInPackage: false, 
    quantity: '', 
    unitCost: '', // this will be either per package or per base unit depending on buyInPackage
  });

  const [selectedProductInfo, setSelectedProductInfo] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [suppRes, prodRes, posRes] = await Promise.all([
        client.get('/purchases/suppliers'),
        client.get('/products'),
        client.get('/sales/pos-data')
      ]);
      setSuppliers(suppRes.data.data.filter(s => s.isActive));
      setProducts(prodRes.data.data.filter(p => p.isActive));
      
      const methods = posRes.data.data.paymentMethods;
      setPaymentMethods(methods);
      const cash = methods.find(m => m.name === 'نقدية');
      if (cash) setPaymentMethodId(cash.id);
    } catch (err) {
      toast.error('فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (pid) => {
    const prod = products.find(p => p.id === Number(pid));
    if (prod) {
      setSelectedProductInfo(prod);
      setCurrentItem({
        ...currentItem,
        productId: pid,
        buyInPackage: false,
        unitCost: prod.purchasePrice,
        quantity: ''
      });
    } else {
      setSelectedProductInfo(null);
      setCurrentItem({ ...currentItem, productId: '', unitCost: '', quantity: '' });
    }
  };

  const toggleBuyMode = (isPackage) => {
    if (!selectedProductInfo) return;
    
    // If switching to package, suggest a package price (base price * pieces per package)
    let newCost = currentItem.unitCost;
    if (isPackage && selectedProductInfo.piecesPerPackage) {
      newCost = Number(selectedProductInfo.purchasePrice) * Number(selectedProductInfo.piecesPerPackage);
    } else {
      newCost = selectedProductInfo.purchasePrice;
    }

    setCurrentItem({
      ...currentItem,
      buyInPackage: isPackage,
      unitCost: newCost
    });
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!currentItem.productId || !currentItem.quantity || !currentItem.unitCost) return;
    
    // Calculate final base quantity and base unit cost
    let finalBaseQuantity = Number(currentItem.quantity);
    let finalBaseUnitCost = Number(currentItem.unitCost);

    if (currentItem.buyInPackage && selectedProductInfo && selectedProductInfo.piecesPerPackage) {
      finalBaseQuantity = Number(currentItem.quantity) * Number(selectedProductInfo.piecesPerPackage);
      finalBaseUnitCost = Number(currentItem.unitCost) / Number(selectedProductInfo.piecesPerPackage);
    }

    setItems([...items, { 
      productId: Number(currentItem.productId), 
      productName: selectedProductInfo.name, 
      displayQty: currentItem.quantity,
      isPackage: currentItem.buyInPackage,
      displayUnit: currentItem.buyInPackage ? selectedProductInfo.packageUnit : selectedProductInfo.unit,
      displayCost: currentItem.unitCost,
      baseQuantity: finalBaseQuantity,
      baseUnitCost: finalBaseUnitCost,
      subtotal: Number(currentItem.quantity) * Number(currentItem.unitCost)
    }]);
    
    setCurrentItem({ productId: '', buyInPackage: false, quantity: '', unitCost: '' });
    setSelectedProductInfo(null);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSavePurchase = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (!form.supplierId) return toast.error('اختر المورد');
    if (items.length === 0) return toast.error('أضف أصناف للفاتورة');

    try {
      await client.post('/purchases', {
        supplierId: Number(form.supplierId),
        referenceNo: form.referenceNo || `PUR-${Date.now()}`,
        paidAmount: paidAmount ? Number(paidAmount) : 0,
        paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null,
        // Send base quantity and base unit cost to backend
        items: items.map(i => ({ 
          productId: i.productId, 
          quantity: i.baseQuantity, 
          unitCost: i.baseUnitCost 
        }))
      });
      toast.success('تم حفظ الفاتورة وإضافة المخزون بنجاح');
      setIsSubmitting(false);
      navigate('/purchases/suppliers');
    } catch (err) {
      setIsSubmitting(false);
      toast.error(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة');
    }
  };

  const totalInvoice = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (loading) return <div className="text-center mt-10 font-bold text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">فاتورة مشتريات جديدة 🛒</h2>
        <button onClick={() => navigate('/purchases/suppliers')} className="text-gray-500 hover:text-gray-800 font-bold underline">
          العودة للموردين
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-bold text-gray-700">المورد</label>
          <select className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={form.supplierId} onChange={e=>setForm({...form, supplierId: e.target.value})}>
            <option value="">اختر المورد...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-2 font-bold text-gray-700">رقم الفاتورة المرجعي (اختياري)</label>
          <input type="text" placeholder="سيتولد تلقائياً إذا تُرك فارغاً" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.referenceNo} onChange={e=>setForm({...form, referenceNo: e.target.value})}/>
        </div>
      </div>

      <div className="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-100">
        <h3 className="font-bold mb-4 text-indigo-900 flex items-center gap-2">➕ إضافة صنف للفاتورة</h3>
        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block mb-2 font-bold text-gray-700 text-sm">الصنف</label>
            <select required className="w-full border-2 border-indigo-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={currentItem.productId} onChange={e => handleProductSelect(e.target.value)}>
              <option value="">اختر الصنف...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {selectedProductInfo && selectedProductInfo.packageUnit && (
            <div className="md:col-span-3 flex gap-3 items-center bg-white p-3 rounded-xl border border-indigo-100 mt-2 md:mt-0">
              <span className="text-sm font-bold text-gray-600 ml-2">طريقة الشراء:</span>
              <button type="button" onClick={() => toggleBuyMode(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!currentItem.buyInPackage ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                بالوحدة ({selectedProductInfo.unit})
              </button>
              <button type="button" onClick={() => toggleBuyMode(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentItem.buyInPackage ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                بالكرتونة ({selectedProductInfo.packageUnit})
              </button>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block mb-2 font-bold text-gray-700 text-sm">
              الكمية {currentItem.buyInPackage ? `(بـ ${selectedProductInfo?.packageUnit})` : (selectedProductInfo ? `(بـ ${selectedProductInfo?.unit})` : '')}
            </label>
            <input required type="number" min="0.01" step="0.01" className="w-full border-2 border-indigo-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500" value={currentItem.quantity} onChange={e=>setCurrentItem({...currentItem, quantity: e.target.value})}/>
          </div>

          <div className="md:col-span-2">
            <label className="block mb-2 font-bold text-gray-700 text-sm">
              سعر الشراء للـ {currentItem.buyInPackage ? selectedProductInfo?.packageUnit : (selectedProductInfo ? selectedProductInfo?.unit : 'وحدة')}
            </label>
            <input required type="number" min="0.01" step="0.01" className="w-full border-2 border-indigo-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500" value={currentItem.unitCost} onChange={e=>setCurrentItem({...currentItem, unitCost: e.target.value})}/>
          </div>

          <div className="md:col-span-1">
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold rounded-xl p-3 hover:bg-indigo-700 shadow-md transition-all">إضافة</button>
          </div>
        </form>

        {selectedProductInfo && currentItem.buyInPackage && currentItem.quantity && (
          <div className="mt-4 text-sm text-indigo-700 font-bold bg-indigo-100/50 p-3 rounded-lg border border-indigo-200 inline-block">
            💡 التوضيح: سيتم إضافة {Number(currentItem.quantity) * Number(selectedProductInfo.piecesPerPackage)} {selectedProductInfo.unit} للمخزون، بناءً على أن الـ {selectedProductInfo.packageUnit} يحتوي على {selectedProductInfo.piecesPerPackage} {selectedProductInfo.unit}.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-right border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 border-b text-gray-700 font-bold">الصنف</th>
              <th className="p-4 border-b text-gray-700 font-bold">الكمية المشراة</th>
              <th className="p-4 border-b text-gray-700 font-bold">سعر الشراء</th>
              <th className="p-4 border-b text-gray-700 font-bold">إجمالي الصنف</th>
              <th className="p-4 border-b text-gray-700 font-bold text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 border-b font-bold text-gray-800">{item.productName}</td>
                <td className="p-4 border-b font-bold">
                  {item.displayQty} <span className="text-sm font-normal text-gray-500">{item.displayUnit}</span>
                  {item.isPackage && <div className="text-xs text-indigo-600 mt-1">(= {item.baseQuantity} وحدة أساسية)</div>}
                </td>
                <td className="p-4 border-b">{item.displayCost}</td>
                <td className="p-4 border-b font-bold text-indigo-700">{item.subtotal.toFixed(2)}</td>
                <td className="p-4 border-b text-center">
                  <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg transition-all font-bold">حذف</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold">لم يتم إضافة أصناف للفاتورة بعد</td></tr>}
          </tbody>
          <tfoot className="bg-gray-50 font-bold text-xl border-t-2 border-gray-200">
            <tr>
              <td colSpan="3" className="p-5 text-left text-gray-600">إجمالي الفاتورة:</td>
              <td colSpan="2" className="p-5 text-indigo-700">{totalInvoice.toFixed(2)} جنية</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-gray-50 p-6 border-2 border-gray-200 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-center mb-10">
        <div className="flex gap-6 w-full md:w-2/3">
          <div className="flex-1">
            <label className="block mb-2 font-bold text-gray-700 text-sm">المبلغ المدفوع للتاجر:</label>
            <input type="number" step="0.01" min="0" placeholder="مثال: 500" className="w-full border-2 border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
          </div>
          {Number(paidAmount) > 0 && (
            <div className="flex-1">
              <label className="block mb-2 font-bold text-gray-700 text-sm">الخزينة (لسحب المبلغ):</label>
              <select className="w-full border-2 border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)}>
                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-end w-full md:w-auto mt-4 md:mt-0">
          <div className="text-left w-full">
            <div className="text-gray-500 text-sm font-bold mb-1">إجمالي الفاتورة</div>
            <div className="text-3xl font-black text-indigo-700">{totalInvoice.toFixed(2)} جنية</div>
            {Number(paidAmount) > 0 && Number(paidAmount) < totalInvoice && (
              <div className="text-sm text-red-600 font-bold mt-1">الباقي مديونية: {(totalInvoice - Number(paidAmount)).toFixed(2)} جنية</div>
            )}
            {Number(paidAmount) > totalInvoice && (
              <div className="text-sm text-green-600 font-bold mt-1">المتبقي لك: {(Number(paidAmount) - totalInvoice).toFixed(2)} جنية (يُخصم من ديون سابقة)</div>
            )}
          </div>
          <button onClick={handleSavePurchase} disabled={items.length === 0 || isSubmitting} className="w-full bg-green-600 text-white px-10 py-3.5 rounded-xl font-black text-lg hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            ✅ تأكيد وحفظ الفاتورة
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewPurchasePage;
