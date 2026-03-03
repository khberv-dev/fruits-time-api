import { dataSource } from '@/config/database.config';
import { User } from '@/shared/entities/user.entity';
import { hashPassword } from '@/utils/hash.util';
import { UserRole } from '@/shared/enums/user-role.enum';
import * as fs from 'node:fs';

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const phoneNumber = '998990000000';
  const password = '12345678';
  const passwordHash = await hashPassword(password);

  await userRepo.save({
    firstName: 'Admin',
    phoneNumber,
    password: passwordHash,
    role: UserRole.ADMIN,
  });

  fs.writeFileSync('.password', `${phoneNumber}:${password}`);
  console.log(`Created ADMIN. Credentials ${phoneNumber}:${password}`);

  await dataSource.destroy();
}

seed();
