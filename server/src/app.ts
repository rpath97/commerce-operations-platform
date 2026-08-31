import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { JSON_BODY_LIMIT } from './config/auth.js'
import { env } from './config/env.js'
import { applyTrustProxy } from './config/trustProxy.js'
import { attachProductionFrontend, resolveClientDist } from './frontend.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requireTrustedOrigin } from './middleware/trustedOrigin.middleware.js'
import { apiRouter } from './routes/index.js'

export const app = express()

app.disable('x-powered-by')
applyTrustProxy(app, env.nodeEnv, env.trustProxyHops)

app.use(
  helmet({
    // Default Helmet CSP blocks the Vite production bundle (module scripts).
    contentSecurityPolicy: false,
    // Local Vite (5173) and API (3001) are different origins; production is same-origin.
    crossOriginResourcePolicy: {
      policy: env.nodeEnv === 'production' ? 'same-origin' : 'cross-origin',
    },
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
app.use('/api', notFound)

if (env.nodeEnv === 'production') {
  attachProductionFrontend(app, resolveClientDist())
}

app.use(notFound)
app.use(errorHandler)
