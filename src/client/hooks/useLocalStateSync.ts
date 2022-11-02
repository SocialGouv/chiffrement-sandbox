import { LocalStateSync, LocalStateSyncConfig } from 'local-state-sync'
import React from 'react'

export function useLocalStateSync<StateType>(
  defaultState: StateType,
  config: Omit<LocalStateSyncConfig<StateType>, 'onStateUpdated'>
) {
  const [state, _setState] = React.useState<StateType>(defaultState)
  const [localStateSync, setLocalStateSync] = React.useState(
    () =>
      new LocalStateSync({
        ...config,
        onStateUpdated: _setState,
      })
  )
  React.useEffect(() => {
    console.log(`Rebuilding with ${JSON.stringify(config)}`)
    setLocalStateSync(
      new LocalStateSync({
        ...config,
        onStateUpdated: _setState,
      })
    )
  }, [config.encryptionKey, config.namespace])
  const setState = React.useCallback(
    (newState: StateType) => {
      _setState(newState)
      return localStateSync.setState(newState)
    },
    [localStateSync]
  )
  return [state, setState] as const
}
