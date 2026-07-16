// database/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('جاري إعداد وتغذية قاعدة البيانات...');

  // 1. إنشاء الصلاحيات الأساسية في النظام
  const permissionsData = [
    { name: 'MANAGE_USERS' },
    { name: 'MANAGE_SERVICES' },
    { name: 'MANAGE_PAYMENTS' },
    { name: 'ACCESS_CHAT' },
    { name: 'CREATE_OFFER' }
  ];

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // 2. إنشاء الرتب وربطها بالصلاحيات المناسبة لها
  const allPermissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      permissions: {
        connect: allPermissions.map(p => ({ id: p.id }))
      }
    }
  });

  const clientRole = await prisma.role.upsert({
    where: { name: 'CLIENT' },
    update: {},
    create: {
      name: 'CLIENT',
      permissions: {
        connect: allPermissions.filter(p => ['ACCESS_CHAT', 'CREATE_OFFER'].includes(p.name)).map(p => ({ id: p.id }))
      }
    }
  });

  const providerRole = await prisma.role.upsert({
    where: { name: 'PROVIDER' },
    update: {},
    create: {
      name: 'PROVIDER',
      permissions: {
        connect: allPermissions.filter(p => ['ACCESS_CHAT'].includes(p.name)).map(p => ({ id: p.id }))
      }
    }
  });

  // 3. إضافة إعدادات النظام الافتراضية
  const defaultSettings = [
    { key: 'site_name', value: 'Boostify AI' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'commission_rate', value: '0.15' } // عمولة المنصة 15%
  ];

  for (const setting of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }

  console.log('تمت تغذية البيانات بنجاح!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });