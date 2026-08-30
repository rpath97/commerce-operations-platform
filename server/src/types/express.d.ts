import type { PublicUser } from '../config/auth.js'

export {}

declare global {
  namespace Express {
    interface Request {
      auth?: PublicUser
    }
  }
}
