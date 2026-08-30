import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(testsDir, '../.env') })
