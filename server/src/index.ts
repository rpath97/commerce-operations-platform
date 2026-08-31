import { app } from './app.js'
import { env } from './config/env.js'

function onListening(): void {
  if (env.nodeEnv === 'production') {
    console.log(`CommerceOps listening on port ${env.port}`)
    return
  }

  console.log(`CommerceOps API listening on http://localhost:${env.port}`)
}

if (env.nodeEnv === 'production') {
  app.listen(env.port, '0.0.0.0', onListening)
} else {
  app.listen(env.port, onListening)
}
