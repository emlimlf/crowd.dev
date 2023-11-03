import axios, { AxiosRequestConfig } from 'axios'
import { RateLimitError } from '@crowd/types'
import type { DiscourseConnectionParams, DiscourseCategoryResponse } from '../types'
import { IProcessStreamContext } from '../../../types'

export const getDiscourseCategories = async (
  params: DiscourseConnectionParams,
  ctx: IProcessStreamContext,
): Promise<DiscourseCategoryResponse> => {
  ctx.log.info({
    message: 'Fetching categories from Discourse',
    forumHostName: params.forumHostname,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: AxiosRequestConfig<any> = {
    method: 'get',
    url: `${params.forumHostname}/categories.json`,
    headers: {
      'Api-Key': params.apiKey,
      'Api-Username': params.apiUsername,
    },
  }

  try {
    const response = await axios(config)
    return response.data
  } catch (err) {
    if (err.response && err.response.status === 429) {
      // wait 5 mins
      throw new RateLimitError(5 * 60, 'discourse/getcategories')
    }
    ctx.log.error({ err, params }, 'Error while getting Discourse categories')
    throw err
  }
}
