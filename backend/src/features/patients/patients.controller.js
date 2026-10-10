const patientsService = require('./patients.service');

const getAll = async (req, res, next) => {
  try {
    const patients = await patientsService.getAllPatients();
    res.json({ success: true, data: patients });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const patient = await patientsService.getPatientById(Number(req.params.id));
    if (!patient) return res.status(404).json({ success: false, message: 'غير موجود' });
    res.json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const patient = await patientsService.createPatient(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'تم إضافة المريض بنجاح', data: patient });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const toggleStatus = async (req, res, next) => {
  try {
    const patient = await patientsService.updatePatientStatus(Number(req.params.id), req.body.isActive);
    res.json({ success: true, message: 'تم تحديث الحالة', data: patient });
  } catch (error) {
    next(error);
  }
};

const transact = async (req, res, next) => {
  try {
    const transaction = await patientsService.addTransaction(req.body, req.user.id);
    res.json({ success: true, message: 'تمت العملية بنجاح', data: transaction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getAll, getById, create, toggleStatus, transact };

