const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user.role) {
        return res.status(403).json({ success: false, message: 'لا تملك صلاحية' });
      }

      let permissions = [];
      try {
        permissions = JSON.parse(user.role.permissions);
      } catch (e) {
        permissions = user.role.permissions || [];
      }

      if (permissions.includes('ALL') || permissions.includes(requiredPermission)) {
        return next();
      }

      return res.status(403).json({ success: false, message: 'عذراً، لا تملك الصلاحية المطلوبة لتنفيذ هذا الإجراء' });
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { checkPermission };
