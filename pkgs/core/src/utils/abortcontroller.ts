export function chainSignalToAbortController(
  source?: AbortSignal,
  chainTo?: AbortController,
) {
  if (!source || !chainTo) return
  source.addEventListener('abort', () => chainTo.abort(), { once: true })
}

export function combineAbortsignals(...signals: (AbortSignal | undefined)[]) {
  const controller = new AbortController()
  const onAborted = () => controller.abort()

  signals.forEach((sig) => {
    sig?.addEventListener('abort', onAborted, { signal: controller.signal })
  })

  return controller.signal
}
