const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const enrichValues = (jsonStr, lookups) => {
  if (!jsonStr) return null;
  try {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const enriched = {};

    for (const [key, value] of Object.entries(data)) {
      // Never expose passwords in audit logs
      if (['password', 'passwordHash'].includes(key)) {
        continue;
      }

      if (key === 'categoryId') {
        const catName = lookups.categories[value] || lookups.categories[Number(value)] || `تصنيف #${value}`;
        enriched['تصنيف المصروف'] = catName;
      } else if (key === 'paymentMethodId' || key === 'paymentMethod') {
        const pmName = lookups.paymentMethods[value] || lookups.paymentMethods[Number(value)] || (typeof value === 'string' && isNaN(value) ? value : `قناة #${value}`);
        enriched['طريقة الدفع / القناة'] = pmName;
      } else if (key === 'fromMethodId') {
        const pmName = lookups.paymentMethods[value] || lookups.paymentMethods[Number(value)] || `قناة #${value}`;
        enriched['من قناة'] = pmName;
      } else if (key === 'toMethodId') {
        const pmName = lookups.paymentMethods[value] || lookups.paymentMethods[Number(value)] || `قناة #${value}`;
        enriched['إلى قناة'] = pmName;
      } else if (key === 'supplierId') {
        const supName = lookups.suppliers[value] || lookups.suppliers[Number(value)] || `مورد #${value}`;
        enriched['المورد'] = supName;
      } else if (key === 'roleId') {
        const roleName = lookups.roles[value] || lookups.roles[Number(value)] || `دور #${value}`;
        enriched['الصلاحية / الدور'] = roleName;
      } else if (key === 'productId') {
        const prodName = lookups.products[value] || lookups.products[Number(value)] || `صنف #${value}`;
        enriched['الصنف'] = prodName;
      } else if (key === 'items' && Array.isArray(value)) {
        enriched['الأصناف والكميات'] = value.map(it => {
          const pName = lookups.products[it.productId] || lookups.products[Number(it.productId)] || it.productName || `صنف #${it.productId}`;
          const qty = it.quantity || 1;
          const cost = it.unitCost !== undefined ? ` (سعر الشراء: ${it.unitCost} ج.م)` : '';
          return `${pName} [الكمية: ${qty}]${cost}`;
        }).join('، ');
      } else if (typeof value === 'number' && ['amount', 'paidAmount', 'totalAmount', 'initialBalance', 'sellingPrice', 'purchasePrice'].includes(key)) {
        enriched[key] = `${value} ج.م`;
      } else {
        enriched[key] = value;
      }
    }

    return JSON.stringify(enriched);
  } catch (e) {
    return jsonStr;
  }
};

exports.getAuditLogs = async (paramsOrPage = 1, maybeLimit = 50) => {
  let page = 1;
  let limit = 50;
  let entityType = null;
  let action = null;
  let search = null;
  let sort = 'desc';

  if (typeof paramsOrPage === 'object' && paramsOrPage !== null) {
    page = parseInt(paramsOrPage.page) || 1;
    limit = parseInt(paramsOrPage.limit) || 50;
    entityType = paramsOrPage.entityType ? String(paramsOrPage.entityType).trim() : null;
    action = paramsOrPage.action ? String(paramsOrPage.action).trim() : null;
    search = paramsOrPage.search ? String(paramsOrPage.search).trim() : null;
    sort = paramsOrPage.sort === 'asc' ? 'asc' : 'desc';
  } else {
    page = parseInt(paramsOrPage) || 1;
    limit = parseInt(maybeLimit) || 50;
  }

  const skip = (page - 1) * limit;

  // Build Prisma where clause
  const where = {};

  if (entityType) {
    where.entityType = entityType;
  }

  if (action) {
    where.action = action;
  }

  if (search) {
    const orConditions = [
      { user: { fullName: { contains: search } } },
      { user: { username: { contains: search } } },
      { newValues: { contains: search } },
      { oldValues: { contains: search } },
      { entityType: { contains: search } },
      { action: { contains: search } }
    ];

    const numSearch = Number(search);
    if (!isNaN(numSearch) && Number.isInteger(numSearch)) {
      orConditions.push({ entityId: numSearch });
    }

    where.OR = orConditions;
  }

  const orderBy = sort === 'asc'
    ? [{ createdAt: 'asc' }, { id: 'asc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }];
  
  const [logs, total, pms, cats, sups, roles, prods] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { fullName: true, username: true }
        }
      },
      orderBy,
      skip,
      take: limit
    }),
    prisma.auditLog.count({ where }),
    prisma.paymentMethod.findMany({ select: { id: true, name: true } }),
    prisma.expenseCategory.findMany({ select: { id: true, name: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
    prisma.role.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, name: true } })
  ]);

  const lookups = {
    paymentMethods: Object.fromEntries(pms.map(p => [p.id, p.name])),
    categories: Object.fromEntries(cats.map(c => [c.id, c.name])),
    suppliers: Object.fromEntries(sups.map(s => [s.id, s.name])),
    roles: Object.fromEntries(roles.map(r => [r.id, r.name])),
    products: Object.fromEntries(prods.map(p => [p.id, p.name]))
  };

  const enrichedLogs = logs.map(log => ({
    ...log,
    newValues: enrichValues(log.newValues, lookups),
    oldValues: enrichValues(log.oldValues, lookups)
  }));

  return {
    data: enrichedLogs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};
