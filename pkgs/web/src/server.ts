import next from 'next'
import https from 'https'
import fs from 'fs'
import { parse } from 'url'
import { join } from 'path'

const port = parseInt(process.env.PORT || '3001')
const host = '0.0.0.0'

const app = next({
  dev: process.env.NODE_ENV !== 'production',
})

;(async () => {
  await app.prepare()
  const handle = app.getRequestHandler()

  https
    .createServer(
      {
        key: fs.readFileSync('./certs/localhost.key'),
        cert: fs.readFileSync('./certs/localhost.crt'),
      },
      (req, res) => {
        const parsedUrl = parse(req.url!, true)
        const { pathname } = parsedUrl

        if (
          pathname === '/sw.js' ||
          /^\/(workbox|worker|fallback)-\w+\.js$/.test(pathname!)
        ) {
          const filePath = join(__dirname, '../public', pathname!)
          // app.serveStatic(req, res, filePath)
          res.setHeader('Content-Type', 'application/javascript')
          fs.createReadStream(filePath).pipe(res)
        } else {
          handle(req, res, parsedUrl)
        }
      }
    )
    .listen(port, host)

  console.log(`> Ready on https://localhost:${port}`)
})()
