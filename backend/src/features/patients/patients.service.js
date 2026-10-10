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

const createPatient = async (data) => {
  const { fileNumber, fullName, internalNumber, notes } = data;

  const existingFile = await prisma.patient.findUnique({ where: { fileNumber } });
  if (existingFile) throw new Error('رقم الملف موجود مسبقاً');

  const existingInternal = await prisma.patient.findUnique({ where: { internalNumber } });
  if (existingInternal) throw new Error('الرقم العسكري (الداخلي) موجود مسبقاً');

  return prisma.patient.create({
    data: { fileNumber, fullName, internalNumber, notes }
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

    // Calculate new debt: DEPOSIT decreases debt, WITHDRAWAL increases debt (or reduces positive balance)
    let newDebt = Number(patient.currentDebt);
    if (type === 'DEPOSIT') {
      newDebt -= pAmount;
    } else if (type === 'WITHDRAWAL') {
      newDebt += pAmount;
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
      data: { currentDebt: newDebt }
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

module.exports = { getAllPatients, getPatientById, createPatient, updatePatientStatus, addTransaction };
