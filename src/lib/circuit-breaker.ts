// src/lib/circuit-breaker.ts
export type BreakerState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerOptions {
  name: string
  failureThreshold: number
  recoveryTimeMs: number
  timeoutMs: number
}

export class CircuitOpenError extends Error {
  constructor(public readonly breakerName: string) {
    super(`Circuit breaker OPEN: ${breakerName} temporarily unavailable`)
    this.name = 'CircuitOpenError'
  }
}

export class CircuitBreaker {
  private state: BreakerState = 'closed'
  private failures = 0
  private lastFailureTime = 0
  private halfOpenProbeInFlight = false

  constructor(private readonly opts: CircuitBreakerOptions) {}

  async fire<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.opts.recoveryTimeMs) {
        this.state = 'half_open'
      } else {
        throw new CircuitOpenError(this.opts.name)
      }
    }
    if (this.state === 'half_open' && this.halfOpenProbeInFlight) {
      throw new CircuitOpenError(this.opts.name)
    }
    if (this.state === 'half_open') this.halfOpenProbeInFlight = true
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${this.opts.timeoutMs}ms`)), this.opts.timeoutMs)
        ),
      ])
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failures = 0
    this.halfOpenProbeInFlight = false
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    this.halfOpenProbeInFlight = false
    if (this.failures >= this.opts.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): BreakerState { return this.state }
  reset() { this.state = 'closed'; this.failures = 0; this.halfOpenProbeInFlight = false }
}

const _breakers = new Map<string, CircuitBreaker>()

export function getBreaker(
  name: string,
  opts?: Partial<Omit<CircuitBreakerOptions, 'name'>>,
): CircuitBreaker {
  if (!_breakers.has(name)) {
    _breakers.set(name, new CircuitBreaker({
      name,
      failureThreshold: opts?.failureThreshold ?? 5,
      recoveryTimeMs:   opts?.recoveryTimeMs   ?? 60_000,
      timeoutMs:        opts?.timeoutMs         ?? 30_000,
    }))
  }
  return _breakers.get(name)!
}

export async function withOpenAIBreaker<T>(
  breakerName: 'openai-completion' | 'openai-embedding',
  fn: () => Promise<T>,
): Promise<T> {
  return getBreaker(breakerName).fire(fn)
}

export function getAllBreakerStates(): Record<string, BreakerState> {
  const out: Record<string, BreakerState> = {}
  for (const [name, breaker] of Array.from(_breakers)) {
    out[name] = breaker.getState()
  }
  // Always include the two known breakers so UI always shows them
  if (!('openai-completion' in out)) out['openai-completion'] = getBreaker('openai-completion').getState()
  if (!('openai-embedding'  in out)) out['openai-embedding']  = getBreaker('openai-embedding').getState()
  return out
}
