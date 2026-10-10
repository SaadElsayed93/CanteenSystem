import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const ReturnsPage = () => {
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
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
    fetchRecentInvoices();
  }, []);

  const fetchRecentInvoices = async () => {
    try {
      const res = await client.get('/sales/invoices');
      setRecentInvoices(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

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

    const openInvoiceFromList = (invNumber) => {
    setInvoiceNumber(invNumber);
    client.get(`/returns/invoice/${invNumber}`).then(res => {
      setInvoice(res.data.data);
      setError('');
      setReturnCart(res.data.data.items.map(i => ({
        ...i,
        returnQty: 0
      })));
    }).catch(err => {
      setError('الفاتورة غير موجودة');
      setInvoice(null);
    });
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-6 max-h-[85vh] flex flex-col">
          <h2 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2">📦 الفواتير الأخيرة</h2>
          <p className="text-gray-500 text-sm mb-4">ابحث برقم الفاتورة، اسم المريض، أو اسم الصنف (شيبسي، كولا...)</p>
          
          <input 
            type="text" 
            placeholder="🔍 بحث سريع في الفواتير..." 
            className="w-full border-2 border-indigo-100 rounded-xl p-3 font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all mb-4 bg-gray-50"
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {recentInvoices.filter(inv => {
              const term = searchTerm.toLowerCase();
              return inv.invoiceNumber.toLowerCase().includes(term) ||
                     (inv.patient && inv.patient.fullName.toLowerCase().includes(term)) ||
                     inv.items.some(i => i.product.name.toLowerCase().includes(term));
            }).map(inv => (
              <div 
                key={inv.id} 
                onClick={() => openInvoiceFromList(inv.invoiceNumber)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md ${invoice?.id === inv.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-100 bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 text-sm">{inv.invoiceNumber}</span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">{inv.totalAmount} ج.م</span>
                </div>
                <div className="text-xs text-gray-500 font-bold">
                  {inv.paymentType === 'CASH' ? '💰 نقدي' : `👤 ${inv.patient?.fullName || 'آجل'}`}
                </div>
                <div className="text-xs text-gray-400 mt-2 line-clamp-1">
                  🛒 {inv.items.map(i => i.product.name).join('، ')}
                </div>
              </div>
            ))}
            {recentInvoices.length === 0 && <div className="text-center text-gray-400 font-bold py-10">لا توجد فواتير</div>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🔍 استرجاع برقم الفاتورة مباشرة</h2>
            <form onSubmit={searchInvoice} className="flex gap-3 max-w-xl mx-auto mt-4">
              <input 
                type="text" 
                placeholder="مثال: INV-123456789..." 
                className="flex-1 border-2 border-indigo-200 rounded-xl p-4 text-lg font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                value={invoiceNumber} 
                onChange={e => setInvoiceNumber(e.target.value)} 
              />
              <button type="submit" className="bg-indigo-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                بحث
              </button>
            </form>
            {error && <div className="text-red-500 font-bold mt-4 animate-in slide-in-from-top-2">{error}</div>}
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
              <div className="font-bold text-gray-800">{invoice.paymentType === 'CASH' ? 'نقدي (كاش)' : 'آجل (مديون)'}</div>
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
                  <span className="text-gray-500 text-sm block">المديونية</span>
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
                  <th className="p-4 border-b font-bold bg-red-50 text-red-700 w-40 text-center">كمية الاسترجاع الآن</th>
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
                <input type="text" placeholder="مثال: الصنف منتهي الصلاحية..." className="w-full border border-gray-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              
              {invoice.paymentType === 'CASH' && (
                <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-100">
                  <label className="block font-bold mb-2 text-red-700">اختر خزينة لخصم المبلغ النقدي منها:</label>
                  <select required className="w-full border border-red-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-800" value={selectedMethodId} onChange={e => setSelectedMethodId(e.target.value)}>
                    <option value="">-- اختر الخزينة التي سيتم رد المبلغ منها --</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (المتاح: {m.currentBalance})</option>)}
                  </select>
                </div>
              )}

              {invoice.paymentType === 'CREDIT' && (
                <div className="mb-6 bg-green-50 p-4 rounded-xl border border-green-100 text-green-700 font-bold flex items-center gap-2">
                  <span>💡</span> سيتم رد قيمة الاسترجاع إلى حساب المريض كإيداع (تقليل من مديونيته) بشكل تلقائي ولن يتم سحب نقدية من الخزينة.
                </div>
              )}

              <div className="text-left mt-4 pt-4 border-t border-gray-200">
                <button onClick={handleReturnSubmit} className="bg-red-600 text-white font-bold px-10 py-4 rounded-xl text-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                  تأكيد وحفظ الاسترجاع
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ReturnsPage;
