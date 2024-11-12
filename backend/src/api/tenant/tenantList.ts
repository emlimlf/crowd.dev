import { Error403 } from '@crowd/common'

import TenantService from '../../services/tenantService'

export default async (req, res) => {
  if (!req.currentUser || !req.currentUser.id) {
    throw new Error403(req.language)
  }

  const payload = await new TenantService(req).findAndCountAll(req.query)

  await req.responseHandler.success(req, res, payload)
}
