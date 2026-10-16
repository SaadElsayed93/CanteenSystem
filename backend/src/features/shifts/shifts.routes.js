const express = require('express');
const router = express.Router();
const shiftsController = require('./shifts.controller');
const { authMiddleware } = require('../../common/middleware/auth');
const { disallowRoles } = require('../../common/middleware/permissions');

router.use(authMiddleware);

router.get('/current', shiftsController.getCurrentShift);
router.post(
  '/open',
  disallowRoles(['أدمن', 'مدير'], 'فتح الوردية مخصص لموظف المبيعات/الكاشير فقط'),
  shiftsController.openShift
);
router.post(
  '/close',
  disallowRoles(['أدمن', 'مدير'], 'إغلاق الوردية واليومية مخصص لموظف المبيعات/الكاشير فقط'),
  shiftsController.closeShift
);
router.get('/history', shiftsController.getShiftsHistory);

module.exports = router;
