import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const ReturnsPage = () => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  
  const [returnCart, setReturnCart] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [reason, setReason] = useState('');

  const { hasPermission } = useAuth();

  useEffect(() => {
    // Fetch treasury balances for cash refunds
    client.get('/treasury/balances').then(res => {
      setPaymentMethods(res.data.data);
    }).catch(console.error);
  }, []);

  const searchInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceNumber) return;
    try {
      const res = await client.get(`/returns/invoice/${invoiceNumber}`);
      setInvoice(res.data.data);
      setError('');
      // Initialize return cart
      setReturnCart(res.data.data.items.map(i => ({
        ...i,
        returnQty: 0 // Default returning 0
      })));
    } catch (err) {
      setError('الفاتورة غير موجودة');
      setInvoice(null);
    }
  };

  const handleQtyChange = (itemId, qty) => {
    setReturnCart(cart => cart.map(item => {
      if (item.id === itemId) {
        // Find already returned qty for this item
        const returnedAlready = invoice.returns.reduce((sum, r) => {
          const rit = r.items.find(ri => ri.productId === item.productId);
          return sum + (rit ? Number(rit.quantity) : 0);
        }, 0);
        
        const maxAllowed = item.quantity - returnedAlready;
        let finalQty = Number(qty);
        if (finalQty < 0) finalQty = 0;
        if (finalQty > maxAllowed) finalQty = maxAllowed;
        
        return { ...item, returnQty: finalQty };
      }
      return item;
    }));
  };

  const handleReturnSubmit = async () => {
    const itemsToReturn = returnCart.filter(i => i.returnQty > 0);
    if (itemsToReturn.length === 0) return toast.error('لم تقم بتحديد أي كميات للاسترجاع');
    
    if (invoice.paymentType === 'CASH' && !selectedMethodId) {
      return toast.error('يجب اختيار الخزينة لرد المبلغ النقدي منها');
    }

    const isFull = itemsToReturn.length === returnCart.length && itemsToReturn.every(i => {
      const returnedAlready = invoice.returns.reduce((sum, r) => {
        const rit = r.items.find(ri => ri.productId === i.productId);
        return sum + (rit ? Number(rit.quantity) : 0);
      }, 0);
      return i.returnQty === (i.quantity - returnedAlready);
    });

    try {
      await client.post('/returns', {
        invoiceId: invoice.id,
        type: isFull ? 'FULL' : 'PARTIAL',
        reason,
        paymentMethodId: selectedMethodId ? Number(selectedMethodId) : null,
        returnItems: itemsToReturn.map(i => ({
          invoiceItemId: i.id,
          productId: i.productId,
          quantity: i.returnQty
        }))
      });
      toast.error('تم تنفيذ المرتجع بنجاح');
      setInvoice(null);
      setInvoiceNumber('');
      setReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الاسترجاع');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">المرتجعات (Returns)</h2>

      <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-gray-200 mb-6 max-w-2xl">
        <form onSubmit={searchInvoice} className="flex gap-3">
          <input 
            type="text" 
            placeholder="أدخل رقم الفاتورة للبحث (مثال: INV-12345)" 
            className="flex-1 border border-gray-200 rounded-xl p-4 text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold px-8 rounded-xl shadow-md shadow-indigo-200">بحث الفاتورة</button>
        </form>
        {error && <div className="text-red-600 mt-3 font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
      </div>

      {invoice && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 mb-1">رقم الفاتورة</div>
              <div className="font-bold text-gray-800 text-lg">{invoice.invoiceNumber}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 mb-1">التاريخ</div>
              <div className="font-bold text-gray-800">{new Date(invoice.createdAt).toLocaleString('ar-EG')}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 mb-1">نوع الدفع</div>
              <div className="font-bold text-gray-800">{invoice.paymentType === 'CASH' ? 'نقدي (كاش)' : 'آجل (رصيد)'}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-xs text-gray-500 mb-1">حالة الفاتورة</div>
              <span className={`px-3 py-1 inline-block rounded-full text-sm font-bold border ${invoice.status === 'REFUNDED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {invoice.status === 'REFUNDED' ? 'مسترجعة بالكامل' : 'مكتملة'}
              </span>
            </div>
            {invoice.patient && (
              <div className="col-span-1 md:col-span-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 mt-2 flex justify-between items-center">
                <div>
                  <span className="text-gray-500 text-sm block">العميل (المريض)</span>
                  <span className="font-bold text-lg text-indigo-900">{invoice.patient.fullName}</span>
                </div>
                <div className="text-left">
                  <span className="text-gray-500 text-sm block">الرصيد</span>
                  <span className={`font-bold text-xl ${invoice.patient.currentDebt > 0 ? 'text-green-600' : 'text-red-600'}`}>{invoice.patient.currentDebt}</span>
                </div>
              </div>
            )}
          </div>

          <h3 className="font-bold mb-6 text-xl text-gray-800 flex items-center gap-2"><span>📦</span> أصناف الفاتورة للاسترجاع</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-8 shadow-sm">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-4 border-b font-bold">الصنف</th>
                  <th className="p-4 border-b font-bold text-center">الكمية المباعة</th>
                  <th className="p-4 border-b font-bold text-center">مرتجع سابق</th>
                  <th className="p-4 border-b font-bold">السعر</th>
                  <th className="p-4 border-b font-bold bg-red-50 text-red-700 w-40 text-center">كمية الإسترجاع الآن</th>
                  <th className="p-4 border-b font-bold text-left">إجمالي الاسترجاع</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {returnCart.map(item => {
                  const returnedAlready = invoice.returns.reduce((sum, r) => {
                    const rit = r.items.find(ri => ri.productId === item.productId);
                    return sum + (rit ? Number(rit.quantity) : 0);
                  }, 0);
                  
                  const returnSubtotal = item.returnQty * item.unitPrice;
                  const isFullyReturned = item.quantity - returnedAlready === 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors bg-white">
                      <td className="p-4 border-b font-bold text-gray-800">{item.product.name}</td>
                      <td className="p-4 border-b font-bold text-center text-gray-800">{item.quantity}</td>
                      <td className="p-4 border-b text-center text-red-500 font-bold">{returnedAlready}</td>
                      <td className="p-4 border-b">{item.unitPrice}</td>
                      <td className="p-4 border-b bg-red-50/50 text-center">
                        <input 
                          type="number" 
                          className="w-24 border border-red-200 rounded-lg p-2 text-center font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"
                          value={item.returnQty === 0 ? '' : item.returnQty}
                          placeholder="0"
                          disabled={invoice.status === 'REFUNDED' || isFullyReturned}
                          onChange={e => handleQtyChange(item.id, e.target.value)}
                        />
                      </td>
                      <td className="p-4 border-b font-bold text-red-600 text-left text-lg">{returnSubtotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {invoice.status !== 'REFUNDED' && (
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="mb-6">
                <label className="block font-bold mb-2 text-gray-700">سبب الاسترجاع (اختياري):</label>
                <input type="text" placeholder="مثال: الصنف تالف، خطأ في الفاتورة..." className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              
              {invoice.paymentType === 'CASH' && (
                <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-100">
                  <label className="block font-bold mb-2 text-red-700">خصم مبلغ المرتجع النقدي من الخزينة:</label>
                  <select required className="w-full border border-red-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-800" value={selectedMethodId} onChange={e => setSelectedMethodId(e.target.value)}>
                    <option value="">-- اختر الخزينة التي سيتم رد المبلغ منها --</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (المتاح: {m.currentBalance})</option>)}
                  </select>
                </div>
              )}

              {invoice.paymentType === 'CREDIT' && (
                <div className="mb-6 bg-green-50 p-4 rounded-xl border border-green-100 text-green-700 font-bold flex items-center gap-2">
                  <span>💡</span> سيتم إضافة مبلغ الاسترجاع إلى رصيد المريض بشكل تلقائي ولن يتأثر رصيد الخزينة.
                </div>
              )}

              <div className="text-left mt-4 pt-4 border-t border-gray-200">
                <button onClick={handleReturnSubmit} className="bg-red-600 text-white font-bold px-10 py-4 rounded-xl text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                  تأكيد وتنفيذ المرتجع
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReturnsPage;


