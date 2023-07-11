import { IIntegrationDescriptor } from '../../types'
import generateStreams from './generateStreams'
import { DISCORD_MEMBER_ATTRIBUTES } from './memberAttributes'
import processStream from './processStream'
import processData from './processData'
import { PlatformType } from '@crowd/types'

const descriptor: IIntegrationDescriptor = {
  type: PlatformType.DISCORD,
  memberAttributes: DISCORD_MEMBER_ATTRIBUTES,

  generateStreams,
  processStream,
  processData,
}

export default descriptor