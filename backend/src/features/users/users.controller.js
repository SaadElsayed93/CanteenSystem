const usersService = require('./users.service');

const getAllUsers = async (req, res, next) => {
  try {
    const users = await usersService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await usersService.createUser(req.body);
    res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const user = await usersService.toggleUserStatus(Number(id), isActive);
    res.json({ success: true, message: 'تم تحديث حالة المستخدم', data: user });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await usersService.updateUser(Number(id), req.body, req.user?.id);
    res.json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح', data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const result = await usersService.resetPassword(Number(id), password, req.user?.id);
    res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await usersService.getRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllUsers, createUser, updateUser, resetPassword, toggleUserStatus, getRoles };
