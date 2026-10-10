const homeService = require('./home.service');

const getHome = async (req, res, next) => {
  try {
    const data = await homeService.getHomeDashboardData(req.user.id, req.user.role.name);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHome };
