import bcrypt from 'bcrypt';

export function encryptPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function validatePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function randomOTP() {
  return Math.round(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
}

export function getObjectDefaultValue(obj: object, def: any) {
  return obj[Object.keys(obj)[0]] ?? def;
}
