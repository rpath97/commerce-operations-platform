import type { Express, NextFunction, Request, Response } from 'express'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Compiled `server/dist/frontend.js` and source `server/src/frontend.ts` sit at
 * the same depth under `server/`, so this relative path reaches `client/dist`
 * whether the process is running TypeScript or the production build.
 */
const CLIENT_DIST_FROM_THIS_MODULE = '../../client/dist'

export function resolveClientDist(moduleUrl: string = import.meta.url): string {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), CLIENT_DIST_FROM_THIS_MODULE)
}

export function isApiPath(requestPath: string): boolean {
  return requestPath === '/api' || requestPath.startsWith('/api/')
}

export function attachProductionFrontend(app: Express, clientDist: string): void {
  const indexHtml = path.join(clientDist, 'index.html')

  app.use(
    express.static(clientDist, {
      index: false,
    }),
  )

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    if (isApiPath(req.path)) {
      next()
      return
    }

    res.sendFile(indexHtml, (err) => {
      if (err) {
        next(err)
      }
    })
  })
}
