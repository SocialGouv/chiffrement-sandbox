import { wrap } from 'comlink'
import type { WorkerType } from './keyDerivation.worker'

export const worker = wrap<WorkerType>(
  new Worker(
    new URL(
      /* webpackChunkName: "keyDerivation.worker" */
      './keyDerivation.worker',
      import.meta.url
    ),
    {
      name: 'keyDerivation',
    }
  )
)
