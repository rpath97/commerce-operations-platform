import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { JSON_BODY_LIMIT } from './config/auth.js'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requireTrustedOrigin } from './middleware/trustedOrigin.middleware.js'
import { apiRouter } from './routes/index.js'

export const app = express()

app.disable('x-powered-by')

app.use(
  helmet({
    // This process is the JSON API, not the Vite frontend bundle.
    contentSecurityPolicy: false,
    // Allow the configured browser origin to read credentialed API responses.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
)
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(cookieParser())
app.use(requireTrustedOrigin)

app.use('/api', apiRouter)

app.use(notFound)
app.use(errorHandler)
