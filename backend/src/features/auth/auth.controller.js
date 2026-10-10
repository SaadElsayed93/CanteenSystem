const authService = require('./auth.service');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const data = await authService.login(username, password);
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data
    });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    let permissions = [];
    try {
      permissions = JSON.parse(user.role.permissions);
    } catch(e) {}
    
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role.name,
        permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe };
