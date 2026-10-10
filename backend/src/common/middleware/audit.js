const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logAudit = (action, entityType) => {
  return async (req, res, next) => {
    // Save original send to capture response
    const originalSend = res.json;
    
    res.json = function(data) {
      res.json = originalSend;
      
      // If successful, log it
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user ? req.user.id : null;
        if (userId) {
          // Fire and forget
          prisma.auditLog.create({
            data: {
              action,
              entityType,
              entityId: data.data?.id || null, // Assuming standard response structure
              userId,
              ipAddress: req.ip || req.connection.remoteAddress,
              newValues: req.body ? JSON.stringify(req.body) : null
            }
          }).catch(err => console.error('Audit Log Error:', err));
        }
      }
      return res.json(data);
    };
    
    next();
  };
};

module.exports = { logAudit };
