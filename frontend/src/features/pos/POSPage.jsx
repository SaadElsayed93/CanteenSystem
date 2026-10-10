import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const POSPage = () => {
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [patients, setPatients] = useState([]);
  
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Checkout Form
  const [invoiceType, setInvoiceType] = useState('CASH'); // CASH or CREDIT
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [patientId, setPatientId] = useState('');
  
  const [printInvoice, setPrintInvoice] = useState(null);
  
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchPosData();
  }, []);

  const fetchPosData = async () => {
    try {
      const res = await client.get('/sales/pos-data');
      setProducts(res.data.data.products);
      
      const methods = res.data.data.paymentMethods;
      setPaymentMethods(methods);
      
      // Auto-select "نقدية" for cash
      const cashMethod = methods.find(m => m.name === 'نقدية');
      if (cashMethod) setPaymentMethodId(cashMethod.id);
      
      setPatients(res.data.data.patients);
    } catch (err) {
      alert('فشل في جلب بيانات البيع');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!search) return p.totalStock > 0;
    const match = p.name.includes(search) || p.internalCode.includes(search) || (p.barcode && p.barcode.includes(search));
    return match;
  });

  const handleBarcodeSearch = (e) => {
    e.preventDefault();
    if (!search) return;
    
    // For scanners: exact match on barcode or internal code
    const exactProduct = products.find(p => p.barcode === search || p.internalCode === search);
    
    if (exactProduct) {
      const added = addToCart(exactProduct);
      if (added) setSearch('');
    } else {
      // If it's a manual search and they press enter, but there's no exact match,
      // just let them see the filtered grid. If grid is empty, alert.
      if (filteredProducts.length === 0) {
        alert('صنف غير موجود');
      }
    }
  };

  const addToCart = (product) => {
    if (product.totalStock <= 0) {
      if (!window.confirm(`⚠️ هذا الصنف (${product.name}) انتهى من المخزون! هل أنت متأكد من بيعه وتخفيض المخزون بالسالب؟`)) {
        return false;
      }
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.sellingPrice, quantity: 1, maxStock: product.totalStock }];
    });
    return true;
  };

  const updateQuantity = (productId, qty) => {
    if (qty <= 0) {
      setCart(cart.filter(i => i.productId !== productId));
      return;
    }
    setCart(cart.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(i => i.productId !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('الفاتورة فارغة');
    if (invoiceType === 'CASH' && !paymentMethodId) return alert('اختر طريقة الدفع النقدية');
    if (invoiceType === 'CREDIT' && !patientId) return alert('اختر المريض للبيع الآجل');

    try {
      const res = await client.post('/sales/checkout', {
        type: invoiceType,
        paymentMethodId: invoiceType === 'CASH' ? Number(paymentMethodId) : null,
        patientId: invoiceType === 'CREDIT' ? Number(patientId) : null,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      
      const invoiceData = res.data.data;
      
      // Play cha-ching sound
      const audio = new Audio('/poppop.ai - cha ching sound effect.mp3');
      audio.play().catch(e => console.error("Audio play blocked", e));
      
      // Setup Print View
      setPrintInvoice({
        id: invoiceData.id,
        date: new Date().toLocaleString('ar-EG'),
        type: invoiceType,
        total: totalAmount,
        items: [...cart],
        patientName: invoiceType === 'CREDIT' ? patients.find(p => p.id === Number(patientId))?.fullName : null
      });

      // Reset
      setCart([]);
      setPatientId('');
      fetchPosData(); // update stock
      
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ في الحفظ');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  if (printInvoice) {
    return (
      <div className="bg-white p-8 max-w-md mx-auto shadow mt-10">
        <div className="text-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold mb-2">كانتين الوحدة</h2>
          <p>رقم الفاتورة: #{printInvoice.id}</p>
          <p>التاريخ: {printInvoice.date}</p>
          <p>نوع الفاتورة: {printInvoice.type === 'CASH' ? 'نقدي' : 'آجل'}</p>
          {printInvoice.patientName && <p>العميل: {printInvoice.patientName}</p>}
        </div>
        <table className="w-full text-right mb-6">
          <thead>
            <tr className="border-b">
              <th className="py-2">الصنف</th>
              <th className="py-2">الكمية</th>
              <th className="py-2">السعر</th>
              <th className="py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {printInvoice.items.map(item => (
              <tr key={item.productId}>
                <td className="py-1">{item.name}</td>
                <td className="py-1">{item.quantity}</td>
                <td className="py-1">{item.price}</td>
                <td className="py-1">{item.quantity * item.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-center font-bold text-xl border-t pt-4">
          الإجمالي: {printInvoice.total} جنية
        </div>
        <div className="mt-8 flex justify-center gap-4 no-print">
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded">طباعة الفاتورة</button>
          <button onClick={() => setPrintInvoice(null)} className="bg-gray-600 text-white px-6 py-2 rounded">عودة للبيع</button>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            .no-print { display: none; }
            .bg-white { box-shadow: none; margin: 0; padding: 0; }
            .bg-white, .bg-white * { visibility: visible; }
            .bg-white { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[85vh]">
      {/* Products Grid Section */}
      <div className="md:w-2/3 flex flex-col gap-4">
        <div className="bg-white p-6 shadow-sm border-2 border-gray-200 rounded-2xl">
          <form onSubmit={handleBarcodeSearch} className="flex gap-3">
            <input 
              ref={barcodeInputRef}
              type="text" 
              placeholder="مرر الباركود أو ابحث بالرقم الداخلي أو الاسم..." 
              className="flex-1 border border-gray-200 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold px-8 rounded-xl shadow-md shadow-indigo-200">بحث</button>
          </form>
        </div>

        <div className="bg-white p-6 shadow-sm border-2 border-gray-200 rounded-2xl flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">الأصناف المتوفرة</h3>
            <span className="text-sm text-gray-500">نقرة واحدة للإضافة للفاتورة</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="border-2 border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="font-bold text-gray-800 mb-2 group-hover:text-indigo-800 transition-colors">{p.name}</div>
                <div className="text-indigo-600 font-bold text-lg mb-2">{p.sellingPrice} <span className="text-sm font-normal">جنية</span></div>
                <div className={`text-xs px-2 py-1 inline-block rounded-full ${p.totalStock <= 0 ? 'bg-red-100 text-red-700 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                  المخزون: {p.totalStock}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cart & Checkout Section */}
      <div className="md:w-1/3 bg-white p-6 shadow-sm border-2 border-gray-200 rounded-2xl flex flex-col">
        <h2 className="text-xl font-bold mb-4 border-b border-gray-100 pb-4 text-gray-800">الفاتورة الحالية</h2>
        
        <div className="flex-1 overflow-y-auto mb-4 pr-2">
          {cart.length === 0 ? (
            <div className="text-gray-400 flex flex-col items-center justify-center h-full">
              <span className="text-4xl mb-2">🛒</span>
              <span>لا توجد أصناف في الفاتورة</span>
            </div>
          ) : (
            <table className="w-full text-right">
              <tbody>
                {cart.map(item => (
                  <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-4 w-1/2">
                      <div className="font-bold text-gray-800">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.price} جنية</div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 transition-colors font-bold">-</button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 transition-colors font-bold">+</button>
                      </div>
                    </td>
                    <td className="py-4 font-bold text-indigo-600">
                      {item.price * item.quantity}
                    </td>
                    <td className="py-4 pl-2 text-left">
                      <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 font-bold transition-colors text-xl">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded-xl">
            <span className="text-lg font-bold text-gray-700">الإجمالي:</span>
            <span className="text-2xl font-bold text-indigo-700">{totalAmount} جنية</span>
          </div>

          <div className="mb-5">
            <label className="block mb-3 font-bold text-gray-700">طريقة الدفع:</label>
            <div className="flex gap-4 bg-gray-50 p-1 rounded-xl">
              <label className={`flex-1 text-center py-2 rounded-lg cursor-pointer font-bold transition-all ${invoiceType === 'CASH' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                <input type="radio" name="invoiceType" value="CASH" className="hidden" checked={invoiceType === 'CASH'} onChange={() => { setInvoiceType('CASH'); setPatientId(''); }} />
                نقدي (كاش)
              </label>
              <label className={`flex-1 text-center py-2 rounded-lg cursor-pointer font-bold transition-all ${invoiceType === 'CREDIT' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                <input type="radio" name="invoiceType" value="CREDIT" className="hidden" checked={invoiceType === 'CREDIT'} onChange={() => setInvoiceType('CREDIT')} />
                آجل (رصيد)
              </label>
            </div>
          </div>

          {invoiceType === 'CREDIT' && (
            <div className="mb-5">
              <label className="block mb-2 font-bold text-gray-700">المريض (إجباري):</label>
              <select className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={patientId} onChange={e => setPatientId(e.target.value)}>
                <option value="">-- اختر المريض --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name || p.fullName} - (الرصيد: {p.currentDebt})</option>
                ))}
              </select>
              {patientId && (
                <div className="text-sm mt-2 bg-gray-50 p-3 rounded-xl border-2 border-gray-200">
                  {patients.find(p => p.id === Number(patientId))?.currentDebt < -500 ? (
                    <span className="text-red-600 font-bold block mb-1">⚠️ تحذير: رصيد المريض أقل من -500 جنية (عليه مديونية كبيرة)!</span>
                  ) : null}
                  <span className="text-gray-600 text-xs">سيتم خصم الفاتورة من رصيد المريض.</span>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleCheckout} 
            disabled={cart.length === 0}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 mt-2"
          >
            تأكيد الدفع وطباعة
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
