import { SLACK_ALERTING_CONFIG } from '../conf'
import { SlackAlertTypes, sendSlackAlert } from '@crowd/alerting'
import { DATABASE_IOC, DbStore } from '@crowd/database'
import { LOGGING_IOC, Logger, getChildLogger } from '@crowd/logging'
import { REDIS_IOC, RedisClient } from '@crowd/redis'
import { SQS_IOC } from '@crowd/sqs'
import {
  IActivityData,
  IMemberData,
  INodejsWorkerEmitter,
  IOrganization,
  ISearchSyncWorkerEmitter,
  IntegrationResultState,
  IntegrationResultType,
  PlatformType,
} from '@crowd/types'
import { inject, injectable } from 'inversify'
import DataSinkRepository from '../repo/dataSink.repo'
import ActivityService from './activity.service'
import MemberService from './member.service'
import { OrganizationService } from './organization.service'

@injectable()
export default class DataSinkService {
  private log: Logger

  private readonly repo: DataSinkRepository

  constructor(
    @inject(DATABASE_IOC.store)
    private readonly store: DbStore,
    @inject(SQS_IOC.emitters.nodejsWorker)
    private readonly nodejsWorkerEmitter: INodejsWorkerEmitter,
    @inject(SQS_IOC.emitters.searchSyncWorker)
    private readonly searchSyncWorkerEmitter: ISearchSyncWorkerEmitter,
    @inject(REDIS_IOC.client)
    private readonly redisClient: RedisClient,
    @inject(LOGGING_IOC.logger)
    parentLog: Logger,
  ) {
    this.log = getChildLogger('data-sink-service', parentLog)

    this.repo = new DataSinkRepository(store, this.log)
  }

  private async triggerResultError(
    resultId: string,
    location: string,
    message: string,
    metadata?: unknown,
    error?: Error,
  ): Promise<void> {
    await this.repo.markResultError(resultId, {
      location,
      message,
      metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorString: error ? JSON.stringify(error) : undefined,
    })
  }

  public async createAndProcessActivityResult(
    tenantId: string,
    segmentId: string,
    integrationId: string,
    data: IActivityData,
  ): Promise<void> {
    this.log.debug({ tenantId, segmentId }, 'Creating and processing activity result.')

    const resultId = await this.repo.createResult(tenantId, integrationId, {
      type: IntegrationResultType.ACTIVITY,
      data,
      segmentId,
    })

    await this.processResult(resultId)
  }

  public async processResult(resultId: string): Promise<boolean> {
    this.log.debug({ resultId }, 'Processing result.')

    const resultInfo = await this.repo.getResultInfo(resultId)

    if (!resultInfo) {
      this.log.error({ resultId }, 'Result not found.')
      return false
    }

    this.log = getChildLogger('result-processor', this.log, {
      resultId,
      apiDataId: resultInfo.apiDataId,
      streamId: resultInfo.streamId,
      runId: resultInfo.runId,
      webhookId: resultInfo.webhookId,
      integrationId: resultInfo.integrationId,
      platform: resultInfo.platform,
    })

    if (resultInfo.state !== IntegrationResultState.PENDING) {
      this.log.warn({ actualState: resultInfo.state }, 'Result is not pending.')
      if (resultInfo.state === IntegrationResultState.PROCESSED) {
        this.log.warn('Result has already been processed. Skipping...')
        return false
      }

      await this.repo.resetResults([resultId])
      return false
    }

    // this.log.debug('Marking result as in progress.')
    // await this.repo.markResultInProgress(resultId)

    try {
      const data = resultInfo.data
      switch (data.type) {
        case IntegrationResultType.ACTIVITY: {
          const service = new ActivityService(
            this.store,
            this.nodejsWorkerEmitter,
            this.searchSyncWorkerEmitter,
            this.redisClient,
            this.log,
          )
          const activityData = data.data as IActivityData

          const platform = (activityData.platform ?? resultInfo.platform) as PlatformType

          await service.processActivity(
            resultInfo.tenantId,
            resultInfo.integrationId,
            platform,
            activityData,
            data.segmentId,
          )
          break
        }

        case IntegrationResultType.MEMBER_ENRICH: {
          const service = new MemberService(
            this.store,
            this.nodejsWorkerEmitter,
            this.searchSyncWorkerEmitter,
            this.log,
          )
          const memberData = data.data as IMemberData

          await service.processMemberEnrich(
            resultInfo.tenantId,
            resultInfo.integrationId,
            resultInfo.platform,
            memberData,
          )
          break
        }

        case IntegrationResultType.ORGANIZATION_ENRICH: {
          const service = new OrganizationService(this.store, this.log)
          const organizationData = data.data as IOrganization

          await service.processOrganizationEnrich(
            resultInfo.tenantId,
            resultInfo.integrationId,
            resultInfo.platform,
            organizationData,
          )
          break
        }

        default: {
          throw new Error(`Unknown result type: ${data.type}`)
        }
      }
      await this.repo.deleteResult(resultId)
      return true
    } catch (err) {
      this.log.error(err, 'Error processing result.')
      try {
        await this.triggerResultError(
          resultId,
          'process-result',
          'Error processing result.',
          undefined,
          err,
        )

        await sendSlackAlert({
          slackURL: SLACK_ALERTING_CONFIG().url,
          alertType: SlackAlertTypes.SINK_WORKER_ERROR,
          integration: {
            id: resultInfo.integrationId,
            platform: resultInfo.platform,
            tenantId: resultInfo.tenantId,
            resultId: resultInfo.id,
            apiDataId: resultInfo.apiDataId,
          },
          userContext: {
            currentTenant: {
              name: resultInfo.name,
              plan: resultInfo.plan,
              isTrial: resultInfo.isTrialPlan,
            },
          },
          log: this.log,
          frameworkVersion: 'new',
        })
      } catch (err2) {
        this.log.error(err2, 'Error sending slack alert.')
      }

      return false
    }
  }
}
