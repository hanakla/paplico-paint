import { readFileSync } from 'fs'

const path = process.argv.slice(2)[0]
if (!path) process.exit(1)

console.log('data:image/png;base64,' + readFileSync(path).toString('base64'))
