import 'dotenv/config';
import { dataSource } from '@/shared/config/database.config';
import { User } from '@/shared/entities/user.entity';
import { encryptPassword } from '@/shared/utils/lib';
import { UserRole } from '@/shared/enums/user-role.enum';

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const adminLogin = process.env.INIT_ADMIN_LOGIN;
  const adminPassword = process.env.INIT_ADMIN_PASSWORD ?? '';

  await userRepo.save({
    firstName: 'Admin',
    phoneNumber: adminLogin,
    password: await encryptPassword(adminPassword),
    role: UserRole.ADMIN,
  });

  await dataSource.destroy();
}

seed().catch((error) => {
  console.log('Seeding error:', error);
});
