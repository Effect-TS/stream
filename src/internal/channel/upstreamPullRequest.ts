import * as Debug from "@effect/io/Debug"
import type * as UpstreamPullRequest from "@effect/stream/Channel/UpstreamPullRequest"
import * as OpCodes from "@effect/stream/internal/opCodes/upstreamPullRequest"

/** @internal */
const UpstreamPullRequestSymbolKey = "@effect/stream/Channel/UpstreamPullRequest"

/** @internal */
export const UpstreamPullRequestTypeId: UpstreamPullRequest.UpstreamPullRequestTypeId = Symbol.for(
  UpstreamPullRequestSymbolKey
) as UpstreamPullRequest.UpstreamPullRequestTypeId

/** @internal */
const upstreamPullRequestVariance = {
  _A: (_: never) => _
}

/** @internal */
const proto = {
  [UpstreamPullRequestTypeId]: upstreamPullRequestVariance
}

/** @internal */
export const Pulled = <A>(value: A): UpstreamPullRequest.UpstreamPullRequest<A> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_PULLED },
    value: { value }
  })

/** @internal */
export const NoUpstream = (activeDownstreamCount: number): UpstreamPullRequest.UpstreamPullRequest<never> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_NO_UPSTREAM },
    activeDownstreamCount: { value: activeDownstreamCount }
  })

/** @internal */
export const isUpstreamPullRequest = (u: unknown): u is UpstreamPullRequest.UpstreamPullRequest<unknown> => {
  return typeof u === "object" && u != null && UpstreamPullRequestTypeId in u
}

/** @internal */
export const isPulled = <A>(
  self: UpstreamPullRequest.UpstreamPullRequest<A>
): self is UpstreamPullRequest.Pulled<A> => {
  return self._tag === OpCodes.OP_PULLED
}

/** @internal */
export const isNoUpstream = <A>(
  self: UpstreamPullRequest.UpstreamPullRequest<A>
): self is UpstreamPullRequest.NoUpstream => {
  return self._tag === OpCodes.OP_NO_UPSTREAM
}

/** @internal */
export const match = Debug.dual<
  <A, Z>(
    self: UpstreamPullRequest.UpstreamPullRequest<A>,
    onPulled: (value: A) => Z,
    onNoUpstream: (activeDownstreamCount: number) => Z
  ) => Z,
  <A, Z>(
    onPulled: (value: A) => Z,
    onNoUpstream: (activeDownstreamCount: number) => Z
  ) => (self: UpstreamPullRequest.UpstreamPullRequest<A>) => Z
>(3, <A, Z>(
  self: UpstreamPullRequest.UpstreamPullRequest<A>,
  onPulled: (value: A) => Z,
  onNoUpstream: (activeDownstreamCount: number) => Z
): Z => {
  switch (self._tag) {
    case OpCodes.OP_PULLED: {
      return onPulled(self.value)
    }
    case OpCodes.OP_NO_UPSTREAM: {
      return onNoUpstream(self.activeDownstreamCount)
    }
  }
})
