import type * as UpstreamPullStrategy from "@effect/stream/Channel/UpstreamPullStrategy"
import * as OpCodes from "@effect/stream/internal/opCodes/upstreamPullStrategy"
import type * as Option from "@fp-ts/core/Option"

/** @internal */
const UpstreamPullStrategySymbolKey = "@effect/stream/Channel/UpstreamPullStrategy"

/** @internal */
export const UpstreamPullStrategyTypeId: UpstreamPullStrategy.UpstreamPullStrategyTypeId = Symbol.for(
  UpstreamPullStrategySymbolKey
) as UpstreamPullStrategy.UpstreamPullStrategyTypeId

/** @internal */
const upstreamPullStrategyVariance = {
  _A: (_: never) => _
}

/** @internal */
const proto = {
  [UpstreamPullStrategyTypeId]: upstreamPullStrategyVariance
}

/** @internal */
export const PullAfterNext = <A>(emitSeparator: Option.Option<A>): UpstreamPullStrategy.UpstreamPullStrategy<A> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_PULL_AFTER_NEXT },
    emitSeparator: { value: emitSeparator }
  })

/** @internal */
export const PullAfterAllEnqueued = <A>(
  emitSeparator: Option.Option<A>
): UpstreamPullStrategy.UpstreamPullStrategy<A> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_PULL_AFTER_ALL_ENQUEUED },
    emitSeparator: { value: emitSeparator }
  })

/** @internal */
export const isUpstreamPullStrategy = (u: unknown): u is UpstreamPullStrategy.UpstreamPullStrategy<unknown> => {
  return typeof u === "object" && u != null && UpstreamPullStrategyTypeId in u
}

/** @internal */
export const isPullAfterNext = <A>(
  self: UpstreamPullStrategy.UpstreamPullStrategy<A>
): self is UpstreamPullStrategy.PullAfterNext<A> => {
  return self._tag === OpCodes.OP_PULL_AFTER_NEXT
}

/** @internal */
export const isPullAfterAllEnqueued = <A>(
  self: UpstreamPullStrategy.UpstreamPullStrategy<A>
): self is UpstreamPullStrategy.PullAfterAllEnqueued<A> => {
  return self._tag === OpCodes.OP_PULL_AFTER_ALL_ENQUEUED
}

/** @internal */
export const match = <A, Z>(
  onPullAfterNext: (emitSeparator: Option.Option<A>) => Z,
  onPullAfterAllEnqueued: (emitSeparator: Option.Option<A>) => Z
) => {
  return (self: UpstreamPullStrategy.UpstreamPullStrategy<A>): Z => {
    switch (self._tag) {
      case OpCodes.OP_PULL_AFTER_NEXT: {
        return onPullAfterNext(self.emitSeparator)
      }
      case OpCodes.OP_PULL_AFTER_ALL_ENQUEUED: {
        return onPullAfterAllEnqueued(self.emitSeparator)
      }
    }
  }
}
