import React, { useState, useEffect } from 'react';
import { useShift } from './ShiftContext';
import { 
  X, Lock, Unlock, DollarSign, ArrowLeftRight, 
  Printer, CheckCircle2, AlertTriangle, FileText, Banknote, ShieldAlert
} from 'lucide-react';

export const ShiftModals = () => {
  const {
    isOpen,
    currentShift,
    currentDrawerBalance,
    isOpeningModal,
    setIsOpeningModal,
    isClosingModal,
    setIsClosingModal,
    closedReceipt,
    setClosedReceipt,
    isSubmitting,
    handleOpenShift,
    handleCloseShift
  } = useShift();

  // Form states
  const [openingStartingCash, setOpeningStartingCash] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');

  const [closingCountedCash, setClosingCountedCash] = useState('');
  const [closingTransferCash, setClosingTransferCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // Prefill when open modal opens
  useEffect(() => {
    if (isOpeningModal) {
      setOpeningStartingCash(currentDrawerBalance || 0);
      setOpeningNotes('');
    }
  }, [isOpeningModal, currentDrawerBalance]);

  // Prefill when closing modal opens
  useEffect(() => {
    if (isClosingModal && currentShift) {
      const exp = Number(currentShift.expectedCash || currentDrawerBalance || 0);
      setClosingCountedCash(exp);
      setClosingTransferCash(exp);
      setClosingNotes('');
    }
  }, [isClosingModal, currentShift, currentDrawerBalance]);

  const onOpenSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    await handleOpenShift({
      startingCash: Number(openingStartingCash),
      notes: openingNotes
    });
  };

  const onCloseSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    await handleCloseShift({
      countedAmount: Number(closingCountedCash),
      transferAmount: Number(closingTransferCash || 0),
      notes: closingNotes
    });
  };

  const countedNum = Number(closingCountedCash || 0);
  const transferNum = Number(closingTransferCash || 0);
  const expectedNum = Number(currentShift?.expectedCash || currentDrawerBalance || 0);
  const discrepancy = countedNum - expectedNum;
  const remainingInDrawer = countedNum - transferNum;

  return (
    <>
      {/* 1. OPEN SHIFT MODAL */}
      {isOpeningModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-emerald-100 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Unlock size={26} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black">فتح اليومية والوردية</h3>
                  <p className="text-emerald-100 text-xs font-bold mt-0.5">بدء تسجيل المبيعات والعمليات المالية</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpeningModal(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-xl transition"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={onOpenSubmit} className="p-6 space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-emerald-800 font-bold text-xs">رصيد الدرج المسجل بالنظام حالياً:</p>
                  <p className="text-emerald-950 font-black text-2xl mt-0.5">{Number(currentDrawerBalance || 0).toFixed(2)} <span className="text-sm font-bold text-emerald-700">ج.م</span></p>
                </div>
                <Banknote className="text-emerald-500 opacity-60" size={36} />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-1.5">
                  عهدة بداية اليومية في الدرج (ج.م) *
                </label>
                <input 
                  type="number"
                  step="0.25"
                  min="0"
                  required
                  value={openingStartingCash}
                  onChange={(e) => setOpeningStartingCash(e.target.value)}
                  className="w-full text-xl font-black text-gray-800 p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:bg-white transition"
                  placeholder="0.00"
                />
                <p className="text-gray-400 text-xs font-bold mt-1">تأكد من مطابقة النقدية الموجودة فعلياً في الدرج مع هذا المبلغ.</p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-1.5">
                  ملاحظات أو بيان الافتتاح (اختياري)
                </label>
                <input 
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="w-full font-bold text-gray-800 p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:bg-white transition"
                  placeholder="مثال: استلام العهدة الصباحية بدون مشاكل..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
                >
                  <Unlock size={20} />
                  <span>{isSubmitting ? 'جاري الفتح...' : 'تأكيد فتح اليومية'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpeningModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-5 rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CLOSE SHIFT MODAL */}
      {isClosingModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-2 border-rose-100 overflow-hidden transform transition-all my-8">
            <div className="bg-gradient-to-r from-rose-600 to-slate-800 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Lock size={26} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <span>تقفيل اليومية والوردية {currentShift?.shiftNumber ? `(#${currentShift.shiftNumber})` : ''}</span>
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                    <span className="text-rose-100 font-bold">تسوية النقدية وتوريد الدرج</span>
                    {currentShift?.openedAt && (
                      <span className="bg-white/20 text-white font-mono px-2 py-0.5 rounded-lg border border-white/30 text-[11px]">
                        بدأت: {new Date(currentShift.openedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} - {new Date(currentShift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsClosingModal(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-xl transition"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={onCloseSubmit} className="p-6 space-y-4">
              {/* Financial Breakdown Table */}
              <div className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 space-y-2 text-xs font-bold text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">مسؤول الوردية:</span>
                  <span className="text-gray-900 font-black">{currentShift?.openedBy || 'الكاشير'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-200 bg-rose-50/70 px-2 rounded-lg">
                  <span className="text-rose-900 font-black">تاريخ ووقت بدء اليومية:</span>
                  <span className="text-rose-950 font-black">
                    {currentShift?.openedAt 
                      ? `${new Date(currentShift.openedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} - ${new Date(currentShift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` 
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">عهدة بداية اليومية:</span>
                  <span className="text-gray-900">{Number(currentShift?.startingCash || 0).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200 text-emerald-700">
                  <span>(+) المبيعات النقدية بالدرج:</span>
                  <span className="font-black">{Number(currentShift?.cashSales || 0).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200 text-emerald-700">
                  <span>(+) إيداعات المرضى النقدية:</span>
                  <span className="font-black">{Number(currentShift?.deposits || 0).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200 text-rose-600">
                  <span>(-) المصروفات والمشتريات والردود:</span>
                  <span className="font-black">-{Number(currentShift?.expenses || 0).toFixed(2)} ج.م</span>
                </div>
                {Number(currentShift?.transfers || 0) > 0 && (
                  <div className="flex justify-between py-1 border-b border-gray-200 text-amber-700">
                    <span>(-) توريدات نقدية سابقة:</span>
                    <span className="font-black">-{Number(currentShift?.transfers || 0).toFixed(2)} ج.م</span>
                  </div>
                )}
                
                {/* Expected Cash Highlight */}
                <div className="flex justify-between items-center py-2 px-3 bg-emerald-100/70 border border-emerald-300 rounded-xl mt-2 text-emerald-950 font-black text-sm">
                  <span>النقدية المتوقعة بالدرج (سيستم):</span>
                  <span className="text-base text-emerald-800">{expectedNum.toFixed(2)} ج.م</span>
                </div>
              </div>

              {/* Counted Cash Input */}
              <div>
                <label className="block text-sm font-black text-gray-800 mb-1">
                  النقدية الفعلية المعدودة في الدرج الآن (ج.م) *
                </label>
                <input 
                  type="number"
                  step="0.25"
                  min="0"
                  required
                  value={closingCountedCash}
                  onChange={(e) => setClosingCountedCash(e.target.value)}
                  className="w-full text-xl font-black text-gray-900 p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#007507] focus:bg-white transition"
                  placeholder="0.00"
                />
              </div>

              {/* Live Discrepancy Status */}
              <div className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between ${
                discrepancy === 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : discrepancy > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <span>حالة مطابقة الدرج:</span>
                <span className="text-sm">
                  {discrepancy === 0 && '✅ العد مطابق تماماً للنظام (0.00 ج.م)'}
                  {discrepancy > 0 && `⚠️ زيادة نقدية بالدرج (+${discrepancy.toFixed(2)} ج.م)`}
                  {discrepancy < 0 && `⚠️ عجز نقدي بالدرج (${discrepancy.toFixed(2)} ج.م)`}
                </span>
              </div>

              {/* Transfer Cash to Safe Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1">
                    المبلغ المورد إلى الخزينة الرئيسية (ج.م) *
                  </label>
                  <input 
                    type="number"
                    step="0.25"
                    min="0"
                    max={countedNum}
                    required
                    value={closingTransferCash}
                    onChange={(e) => setClosingTransferCash(e.target.value)}
                    className="w-full font-black text-gray-800 p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#007507] focus:bg-white transition"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1">
                    المتبقي بالدرج للوردية التالية:
                  </label>
                  <div className="p-3 bg-gray-100 border-2 border-gray-200 rounded-xl font-black text-gray-700 text-center">
                    {remainingInDrawer >= 0 ? `${remainingInDrawer.toFixed(2)} ج.م` : 'غير صحيح'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1">
                  ملاحظات التقفيل والتسليم
                </label>
                <input 
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full font-bold text-gray-800 p-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#007507] focus:bg-white transition text-xs"
                  placeholder="ملاحظات التسليم والاستلام بين الورديات..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isNaN(countedNum) || countedNum < 0 || transferNum > countedNum}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2"
                >
                  <Lock size={20} />
                  <span>{isSubmitting ? 'جاري تقفيل الوردية...' : 'تأكيد تقفيل اليومية وتوريد النقدية'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsClosingModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-5 rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SETTLEMENT RECEIPT MODAL */}
      {closedReceipt && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-gray-200 p-6 transform transition-all">
            <div id="shift-settlement-receipt-print" className="border-2 border-dashed border-gray-300 p-6 rounded-2xl bg-white space-y-4 text-center">
              <div>
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-base font-black text-gray-900">المستشفى العسكري ق.م بالإسماعيلية</h4>
                <p className="text-xs font-bold text-gray-600">
                  إدارة الكانتين - إيصال تقفيل الوردية اليومية {closedReceipt.shiftNumber ? `(#${closedReceipt.shiftNumber})` : ''}
                </p>
                <p className="text-xs font-mono text-gray-400 mt-1">
                  {closedReceipt.settledAt ? new Date(closedReceipt.settledAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG')}
                </p>
              </div>

              <div className="space-y-2 text-xs font-bold text-gray-700 text-right">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">المسؤول / الكاشير:</span>
                  <span className="text-gray-900 font-black">{closedReceipt.settledBy || closedReceipt.closedBy}</span>
                </div>
                {closedReceipt.openedAt && (
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500">تاريخ ووقت بدء الوردية:</span>
                    <span className="text-gray-900 font-bold">
                      {`${new Date(closedReceipt.openedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} - ${new Date(closedReceipt.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">رصيد الدرج بالنظام:</span>
                  <span className="text-gray-900">{Number(closedReceipt.systemDrawerBalance || closedReceipt.expectedCash).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">العد الفعلي للنقدية:</span>
                  <span className="text-gray-900 font-black">{Number(closedReceipt.countedAmount).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">حالة المطابقة:</span>
                  <span className="font-black text-[#007507]">{closedReceipt.discrepancyText}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b-2 border-dashed border-gray-300 bg-emerald-50 px-2 rounded-lg">
                  <span className="text-emerald-900 font-black">المبلغ المورد للخزينة:</span>
                  <span className="text-emerald-700 font-black text-sm">{Number(closedReceipt.transferAmount || closedReceipt.transferredCash).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">المتبقي بالدرج كعهدة:</span>
                  <span className="text-gray-900 font-black">{Number(closedReceipt.remainingInDrawer || closedReceipt.remainingCash).toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">رصيد الخزينة الرئيسية الجديد:</span>
                  <span className="text-gray-900">{Number(closedReceipt.mainTreasuryBalance || closedReceipt.mainTreasuryNewBalance).toFixed(2)} ج.م</span>
                </div>
                {closedReceipt.notes && (
                  <div className="py-1 text-gray-500">
                    <span>ملاحظات: </span>
                    <span className="text-gray-800">{closedReceipt.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Printer size={16} />
                <span>طباعة الإيصال</span>
              </button>
              <button 
                type="button" 
                onClick={() => setClosedReceipt(null)} 
                className="px-6 py-2.5 bg-[#007507] hover:bg-[#006006] text-white font-bold rounded-xl transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
