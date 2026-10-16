const shiftsService = require('./shifts.service');

const getCurrentShift = async (req, res, next) => {
  try {
    const data = await shiftsService.getCurrentShift();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const openShift = async (req, res, next) => {
  try {
    const shift = await shiftsService.openShift(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: `تم فتح اليومية والوردية رقم #${shift.shiftNumber} بنجاح`,
      data: shift
    });
  } catch (error) {
    next(error);
  }
};

const closeShift = async (req, res, next) => {
  try {
    const result = await shiftsService.closeShift(req.body, req.user.id);
    res.json({
      success: true,
      message: 'تم تقفيل اليومية بنجاح',
      data: result.shift,
      receipt: result.receipt
    });
  } catch (error) {
    next(error);
  }
};

const getShiftsHistory = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const history = await shiftsService.getShiftsHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentShift,
  openShift,
  closeShift,
  getShiftsHistory
};
