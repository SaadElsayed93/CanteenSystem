const { verifyToken } = require('../utils/security');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'غير مصرح لك بالدخول' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود أو معطل' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً' });
    }
    return res.status(401).json({ success: false, message: 'التوكن غير صالح' });
  }
};

module.exports = { authMiddleware };
