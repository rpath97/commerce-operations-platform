export {}

declare global {
  namespace Express {
    interface Request {
      // Populated in later phases after JWT session parsing.
      userId?: string
    }
  }
}
