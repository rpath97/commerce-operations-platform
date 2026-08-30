import bcrypt from 'bcrypt'
import { BCRYPT_COST_FACTOR } from '../config/auth.js'

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_COST_FACTOR)
}

export async function passwordsMatch(
  plainText: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, passwordHash)
}

let dummyHash: string | undefined

export async function dummyPasswordCheck(plainText: string): Promise<void> {
  dummyHash ??= await hashPassword('timing-dummy')
  await bcrypt.compare(plainText, dummyHash)
}
