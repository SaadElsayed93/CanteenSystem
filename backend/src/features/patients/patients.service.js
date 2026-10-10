const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllPatients = async () => {
  return prisma.patient.findMany({
    orderBy: { currentDebt: 'desc' }
  });
};

const getPatientById = async (id) => {
  return prisma.patient.findUnique({
    where: { id },
    include: {
      transactions: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 }
    }
  });
};

const createPatient = async (data, userId) => {
  const { fileNumber, fullName, internalNumber, notes, initialBalance, paymentMethodId } = data;

  const existingFile = await prisma.patient.findUnique({ where: { fileNumber } });
  if (existingFile) throw new Error('رقم الملف موجود مسبقاً');

  const existingInternal = await prisma.patient.findUnique({ where: { internalNumber } });
  if (existingInternal) throw new Error('الرقم الداخلي (السرير) موجود مسبقاً');

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: { 
        fileNumber, 
        fullName, 
        internalNumber, 
        notes,
        currentDebt: initialBalance ? Number(initialBalance) : 0
      }
    });

    if (initialBalance && Number(initialBalance) > 0) {
      const pAmount = Number(initialBalance);
      
      const transaction = await tx.patientTransaction.create({
        data: {
          patientId: patient.id,
          type: 'DEPOSIT',
          amount: pAmount,
          source: 'إيداع نقدي',
          description: 'رصيد افتتاحي (ديبوزت)',
          createdBy: userId
        }
      });

      if (paymentMethodId) {
        const method = await tx.paymentMethod.findUnique({ where: { id: Number(paymentMethodId) } });
        if (method) {
          await tx.paymentMethod.update({
            where: { id: Number(paymentMethodId) },
            data: { currentBalance: Number(method.currentBalance) + pAmount }
          });

          await tx.treasuryTransaction.create({
            data: {
              paymentMethodId: Number(paymentMethodId),
              type: 'IN',
              amount: pAmount,
              description: `ديبوزت مريض جديد (${patient.fullName}) - رصيد افتتاحي`,
              referenceType: 'PATIENT_TX',
              referenceId: transaction.id,
              createdBy: userId
            }
          });
        }
      }
    }
    
    return patient;
  });
};

const updatePatientStatus = async (id, isActive) => {
  return prisma.patient.update({
    where: { id },
    data: { isActive }
  });
};

const addTransaction = async (data, userId) => {
  const { patientId, type, amount, source, description, paymentMethodId } = data; 
  // type: "DEPOSIT" (سداد دين), "WITHDRAWAL" (سحب رصيد لو له فلوس)
  
  const pAmount = Number(amount);
  if (pAmount <= 0) throw new Error('يجب أن يكون المبلغ أكبر من صفر');

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new Error('المريض غير موجود');

    // Calculate new balance: DEPOSIT increases balance, WITHDRAWAL decreases balance
    let newBalance = Number(patient.currentDebt);
    if (type === 'DEPOSIT') {
      newBalance += pAmount;
    } else if (type === 'WITHDRAWAL') {
      newBalance -= pAmount;
    }

    const transaction = await tx.patientTransaction.create({
      data: {
        patientId,
        type,
        amount: pAmount,
        source,
        description,
        createdBy: userId
      }
    });

    await tx.patient.update({
      where: { id: patientId },
      data: { currentDebt: newBalance }
    });

    // Impact Treasury if a payment method is specified
    if (paymentMethodId) {
      const method = await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (method) {
        let treasuryType = type === 'DEPOSIT' ? 'IN' : 'OUT';
        let balanceChange = type === 'DEPOSIT' ? pAmount : -pAmount;
        
        await tx.paymentMethod.update({
          where: { id: paymentMethodId },
          data: { currentBalance: Number(method.currentBalance) + balanceChange }
        });

        await tx.treasuryTransaction.create({
          data: {
            paymentMethodId,
            type: treasuryType,
            amount: pAmount,
            description: `حركة مريض (${patient.fullName}): ${description || type}`,
            referenceType: 'PATIENT_TX',
            referenceId: transaction.id,
            createdBy: userId
          }
        });
      }
    }

    return transaction;
  });
};

const dischargePatient = async (id, paymentMethodId, userId) => {
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: Number(id) } });
    if (!patient) throw new Error('المريض غير موجود');
    if (!patient.isActive) throw new Error('المريض مغادر بالفعل');

    const currentDebt = Number(patient.currentDebt);
    
    // If there is a balance to settle
    if (currentDebt !== 0) {
      if (!paymentMethodId) throw new Error('يجب تحديد الخزينة لتسوية الحساب المتبقي للمريض');
      
      const method = await tx.paymentMethod.findUnique({ where: { id: Number(paymentMethodId) } });
      if (!method) throw new Error('الخزينة غير صحيحة');
      
      // If currentDebt > 0 (We owe the patient money -> Refund -> Decrease Treasury)
      // If currentDebt < 0 (Patient owes us money -> Settle Debt -> Increase Treasury)
      
      const isRefund = currentDebt > 0; // we refund the deposit back to them
      const absAmount = Math.abs(currentDebt);
      
      // 1. Log Patient Transaction
      const transaction = await tx.patientTransaction.create({
        data: {
          patientId: patient.id,
          type: isRefund ? 'WITHDRAWAL' : 'DEPOSIT',
          amount: absAmount,
          source: 'تصفية حساب مغادرة',
          description: isRefund ? 'رد الرصيد المتبقي للمريض عند المغادرة' : 'تحصيل المديونية المتبقية عند المغادرة',
          createdBy: userId
        }
      });
      
      // 2. Adjust Treasury
      const treasuryType = isRefund ? 'OUT' : 'IN';
      const balanceChange = isRefund ? -absAmount : absAmount;
      
      await tx.paymentMethod.update({
        where: { id: Number(paymentMethodId) },
        data: { currentBalance: Number(method.currentBalance) + balanceChange }
      });

      // 3. Log Treasury Transaction
      await tx.treasuryTransaction.create({
        data: {
          paymentMethodId: Number(paymentMethodId),
          type: treasuryType,
          amount: absAmount,
          description: `تصفية حساب مريض مغادر (${patient.fullName}) - ${isRefund ? 'رد رصيد' : 'تحصيل مديونية'}`,
          referenceType: 'PATIENT_TX',
          referenceId: transaction.id,
          createdBy: userId
        }
      });
    }

        // Mark as inactive/discharged and zero balance
    const updatedPatient = await tx.patient.update({
      where: { id: patient.id },
      data: { isActive: false, currentDebt: 0 }
    });

    const auditNewValues = {
      'المريض': patient.fullName,
      'حالة المريض': 'مغادرة وتصفية حساب',
      'الرصيد المصفى': currentDebt !== 0 ? `${Math.abs(currentDebt)} ج.م` : 'بدون رصيد (مصفر مسبقاً)',
      'نوع التصفية': currentDebt > 0 ? 'رد متبقي للمريض (سحب من الخزينة)' : currentDebt < 0 ? 'تحصيل ديون من المريض (إيداع بالخزينة)' : 'لا يوجد',
    };

    await tx.auditLog.create({
      data: {
        action: 'UPDATE_STATUS',
        entityType: 'PATIENT',
        entityId: patient.id,
        newValues: JSON.stringify(auditNewValues),
        userId: userId
      }
    });

    return updatedPatient;
  });
};

module.exports = { getAllPatients, getPatientById, createPatient, updatePatientStatus, addTransaction, dischargePatient };
