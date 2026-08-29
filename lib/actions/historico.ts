'use server'

import { requireUserId } from '@/lib/auth/require-user'
import { getHistoricoFeed } from '@/lib/queries/historico'
import { filterUuids, normalizeDateRange, type HistoricoParams } from '@/lib/utils/historico-params'

export async function fetchMoreHistorico(params: HistoricoParams) {
  const userId = await requireUserId()
  return getHistoricoFeed(userId, {
    ...params,
    ...normalizeDateRange(params.de, params.ate),
    categorias: filterUuids(params.categorias),
    contas: filterUuids(params.contas),
  })
}
