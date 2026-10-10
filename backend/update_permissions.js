const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSalesRole() {
  const role = await prisma.role.findFirst({
    where: { name: 'مبيعات' }
  });

  if (role) {
    const newPermissions = [
      'CREATE_INVOICE', 
      'VIEW_PRODUCTS', 
      'VIEW_PATIENTS', 
      'CREATE_DEPOSIT',
      'VIEW_TREASURY',     // So they can see Treasury/Expenses
      'VIEW_REPORTS',      // So they can see Reports to close shift
      'MANAGE_PURCHASES'   // So they can enter purchases if goods arrive
    ];
    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: JSON.stringify(newPermissions) }
    });
    console.log('Permissions updated successfully!');
  } else {
    console.log('Sales role not found.');
  }
}

updateSalesRole()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
