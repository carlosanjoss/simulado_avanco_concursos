const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'carlosdeemelo@gmail.com' },
      select: { id: true, email: true, isAdmin: true }
    });
    
    console.log('User before:', user);
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
      select: { email: true, isAdmin: true }
    });
    
    console.log('User after:', updated);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
