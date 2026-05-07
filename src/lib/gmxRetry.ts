export async function withGmxRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3
  const delayMs = options.delayMs ?? 700
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "GMX request failed"
  throw new Error(options.label ? `${options.label}: ${message}` : message)
}

export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  options: { timeoutMs?: number; intervalMs?: number; label?: string } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 45_000
  const intervalMs = options.intervalMs ?? 3_000
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const result = await fn()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(options.label ?? "Timed out waiting for GMX state")
}
