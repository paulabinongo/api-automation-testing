/**
 * Fails CI if OpenAPI 3 document is invalid or has unresolvable $refs.
 * Run: npm run validate:openapi
 */
import SwaggerParser from '@apidevtools/swagger-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const specPath = path.join(__dirname, '..', 'javascript', 'mock-server', 'openapi.json')

await SwaggerParser.validate(specPath)
console.log('OpenAPI OK:', specPath)
