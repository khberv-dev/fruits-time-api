import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// The business runs in one timezone, so everything that reasons about wall-clock time —
// branch working hours, "once per day" subscription entitlements — has to agree on it
// instead of inheriting whatever TZ the deploy host happens to have.
export const BUSINESS_TIMEZONE = 'Asia/Tashkent';

export function businessTime(at: Date = new Date()) {
  return dayjs(at).tz(BUSINESS_TIMEZONE);
}

// Half-open [start, end) bounds of the business-local calendar day containing `at`.
export function businessDayRange(at: Date = new Date()): { start: Date; end: Date } {
  const local = businessTime(at);

  return { start: local.startOf('day').toDate(), end: local.add(1, 'day').startOf('day').toDate() };
}

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

const REFERRAL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFERRAL_LENGTH = 7;

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_LENGTH; i++) {
    code += REFERRAL_CHARSET[randomInt(REFERRAL_CHARSET.length)];
  }
  return code;
}

export function getObjectDefaultValue(obj: object, def: any) {
  return obj[Object.keys(obj)[0]] ?? def;
}

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DELIVERY_BASE_COST = 15_000;
const DELIVERY_COST_PER_KM = 2_500;

export function calculateDeliveryCost(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const distanceKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return Math.round(DELIVERY_BASE_COST + DELIVERY_COST_PER_KM * distanceKm);
}
