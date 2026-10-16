import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthContext';

const ShiftContext = createContext();

export const ShiftProvider = ({ children }) => {
  const { user } = useAuth();
  const [shiftData, setShiftData] = useState({
    isOpen: false,
    currentShift: null,
    lastShift: null,
    currentDrawerBalance: 0
  });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [closedReceipt, setClosedReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshShift = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/shifts/current');
      if (res.data && res.data.data) {
        setShiftData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching shift status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refreshShift();
    } else {
      setLoading(false);
    }
  }, [user, refreshShift]);

  const handleOpenShift = async ({ startingCash, notes }) => {
    setIsSubmitting(true);
    try {
      const res = await client.post('/shifts/open', {
        startingCash: Number(startingCash),
        notes
      });
      toast.success(res.data.message || 'تم فتح اليومية بنجاح');
      setIsOpeningModal(false);
      await refreshShift();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'فشل فتح اليومية';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async ({ countedAmount, transferAmount, notes }) => {
    setIsSubmitting(true);
    try {
      const res = await client.post('/shifts/close', {
        countedAmount: Number(countedAmount),
        transferAmount: Number(transferAmount || 0),
        notes
      });
      toast.success(res.data.message || 'تم تقفيل اليومية بنجاح');
      setIsClosingModal(false);
      if (res.data.receipt) {
        setClosedReceipt(res.data.receipt);
      }
      await refreshShift();
      return { success: true, receipt: res.data.receipt };
    } catch (err) {
      const msg = err.response?.data?.message || 'فشل تقفيل اليومية';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShiftContext.Provider
      value={{
        ...shiftData,
        loading,
        refreshShift,
        isOpeningModal,
        setIsOpeningModal,
        isClosingModal,
        setIsClosingModal,
        closedReceipt,
        setClosedReceipt,
        isSubmitting,
        handleOpenShift,
        handleCloseShift
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => useContext(ShiftContext);
