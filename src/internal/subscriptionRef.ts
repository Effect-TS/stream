import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Hub from "@effect/io/Hub"
import * as _circular from "@effect/io/internal/effect/circular"
import * as _ref from "@effect/io/internal/ref"
import * as Ref from "@effect/io/Ref"
import * as Synchronized from "@effect/io/Ref/Synchronized"
import * as stream from "@effect/stream/internal/stream"
import type { Stream } from "@effect/stream/Stream"
import type * as SubscriptionRef from "@effect/stream/SubscriptionRef"
import * as Equal from "@fp-ts/data/Equal"
import { pipe } from "@fp-ts/data/Function"

/** @internal */
const SubscriptionRefSymbolKey = "@effect/stream/SubscriptionRef"

/** @internal */
export const SubscriptionRefTypeId: SubscriptionRef.SubscriptionRefTypeId = Symbol.for(
  SubscriptionRefSymbolKey
) as SubscriptionRef.SubscriptionRefTypeId

/** @internal */
const subscriptionRefVariance = {
  _A: (_: never) => _
}

/** @internal */
class SubscriptionRefImpl<A> implements SubscriptionRef.SubscriptionRef<A> {
  readonly [Ref.RefTypeId] = _ref.refVariance
  readonly [Synchronized.SynchronizedTypeId] = _circular.synchronizedVariance
  readonly [SubscriptionRefTypeId] = subscriptionRefVariance
  constructor(
    readonly ref: Ref.Ref<A>,
    readonly hub: Hub.Hub<A>,
    readonly semaphore: Effect.Semaphore
  ) {
    Equal.considerByRef(this)
  }
  get changes(): Stream<never, never, A> {
    return pipe(
      Ref.get(this.ref),
      Effect.flatMap((a) =>
        pipe(
          stream.fromHubScoped(this.hub),
          Effect.map((s) =>
            pipe(
              stream.make(a),
              stream.concat(s)
            )
          )
        )
      ),
      this.semaphore(1),
      stream.unwrapScoped
    )
  }
  /** @macro traced */
  modify<B>(f: (a: A) => readonly [B, A]): Effect.Effect<never, never, B> {
    const trace = getCallTrace()
    return this.modifyEffect((a) => Effect.succeed(f(a))).traced(trace)
  }
  /** @macro traced */
  modifyEffect<R, E, B>(f: (a: A) => Effect.Effect<R, E, readonly [B, A]>): Effect.Effect<R, E, B> {
    const trace = getCallTrace()
    return pipe(
      Ref.get(this.ref),
      Effect.flatMap(f),
      Effect.flatMap(([b, a]) =>
        pipe(
          this.ref,
          Ref.set(a),
          Effect.as(b),
          Effect.zipLeft(pipe(this.hub, Hub.publish(a)))
        )
      ),
      this.semaphore(1)
    ).traced(trace)
  }
}

/** @internal */
export const get = <A>(self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<never, never, A> => {
  const trace = getCallTrace()
  return Ref.get(self.ref).traced(trace)
}

/** @internal */
export const make = <A>(value: A): Effect.Effect<never, never, SubscriptionRef.SubscriptionRef<A>> => {
  const trace = getCallTrace()
  return pipe(
    Effect.tuple(
      Hub.unbounded<A>(),
      Ref.make(value),
      Effect.makeSemaphore(1)
    ),
    Effect.map(([hub, ref, semaphore]) => new SubscriptionRefImpl(ref, hub, semaphore))
  ).traced(trace)
}

/** @internal */
export const modify = <A, B>(f: (a: A) => readonly [B, A]) => {
  const trace = getCallTrace()
  return (self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<never, never, B> => self.modify(f).traced(trace)
}

/** @internal */
export const modifyEffect = <A, R, E, B>(f: (a: A) => Effect.Effect<R, E, readonly [B, A]>) => {
  const trace = getCallTrace()
  return (self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<R, E, B> => self.modifyEffect(f).traced(trace)
}

/** @internal */
export const set = <A>(value: A) => {
  const trace = getCallTrace()
  return (self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<never, never, void> =>
    pipe(
      self.ref,
      Ref.set(value),
      Effect.zipLeft(pipe(self.hub, Hub.publish(value))),
      self.semaphore(1)
    ).traced(trace)
}
