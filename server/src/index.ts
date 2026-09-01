import { app } from './app.js'
import { env } from './config/env.js'

function onListening(): void {
  if (env.nodeEnv === 'production') {
    console.log(`Noryx listening on port ${env.port}`)
    return
  }

  console.log(`Noryx API listening on http://localhost:${env.port}`)
}

if (env.nodeEnv === 'production') {
  app.listen(env.port, '0.0.0.0', onListening)
} else {
  app.listen(env.port, onListening)
}
