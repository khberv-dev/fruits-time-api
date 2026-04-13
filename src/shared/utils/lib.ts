import bcrypt from 'bcrypt';

export function encryptPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function validatePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
