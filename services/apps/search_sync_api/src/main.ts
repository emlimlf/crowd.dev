import { getServiceLogger } from '@crowd/logging'
import cors from 'cors'
import express from 'express'
import { DB_CONFIG, SEARCH_SYNC_API_CONFIG } from './conf'
import { databaseMiddleware } from './middleware/database'
import { errorMiddleware } from './middleware/error'
import { loggingMiddleware } from './middleware/logging'
import { InitService, OpenSearchService } from '@crowd/opensearch'
import memberRoutes from './routes/member'
import activityRoutes from './routes/activity'
import organizationRoutes from './routes/organization'
import { getDbConnection } from '@crowd/database'
import { opensearchMiddleware } from 'middleware/opensearch'

const log = getServiceLogger()
const config = SEARCH_SYNC_API_CONFIG()

setImmediate(async () => {
  const app = express()
  const openSearchService = new OpenSearchService(log)
  const dbConnection = await getDbConnection(DB_CONFIG(), 3)

  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true, limit: '5mb' }))
  app.use(loggingMiddleware(log))
  app.use(databaseMiddleware(dbConnection))
  app.use(opensearchMiddleware(log))

  // init opensearch service
  const initService = new InitService(openSearchService, log)
  await initService.initialize()

  // add routes
  app.use(memberRoutes)
  app.use(activityRoutes)
  app.use(organizationRoutes)

  app.use(errorMiddleware())

  app.listen(config.port, () => {
    log.info(`Search Sync API listening on port ${config.port}!`)
  })
})
