export function randomOTP() {
  return Math.floor(Math.random() * 100000)
    .toString()
    .padStart(6, '0');
}
