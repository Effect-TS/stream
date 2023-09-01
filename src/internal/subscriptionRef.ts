import { dual, pipe } from "@effect/data/Function"
import { pipeArguments } from "@effect/data/Pipeable"
import * as Effect from "@effect/io/Effect"
import * as Hub from "@effect/io/Hub"
import * as _circular from "@effect/io/internal/effect/circular"
import * as _ref from "@effect/io/internal/ref"
import * as Ref from "@effect/io/Ref"
import * as Synchronized from "@effect/io/SynchronizedRef"
import * as stream from "@effect/stream/internal/stream"
import type { Stream } from "@effect/stream/Stream"
import type * as SubscriptionRef from "@effect/stream/SubscriptionRef"

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
  // @ts-ignore
  readonly [Ref.RefTypeId] = _ref.refVariance
  // @ts-ignore
  readonly [Synchronized.SynchronizedRefTypeId] = _circular.synchronizedVariance
  readonly [SubscriptionRefTypeId] = subscriptionRefVariance
  constructor(
    readonly ref: Ref.Ref<A>,
    readonly hub: Hub.Hub<A>,
    readonly semaphore: Effect.Semaphore
  ) {
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
  get changes(): Stream<never, never, A> {
    return pipe(
      Ref.get(this.ref),
      Effect.flatMap((a) =>
        Effect.map(
          stream.fromHub(this.hub, { scoped: true }),
          (s) =>
            stream.concat(
              stream.make(a),
              s
            )
        )
      ),
      this.semaphore.withPermits(1),
      stream.unwrapScoped
    )
  }
  modify<B>(f: (a: A) => readonly [B, A]): Effect.Effect<never, never, B> {
    return this.modifyEffect((a) => Effect.succeed(f(a)))
  }
  modifyEffect<R, E, B>(f: (a: A) => Effect.Effect<R, E, readonly [B, A]>): Effect.Effect<R, E, B> {
    return pipe(
      Ref.get(this.ref),
      Effect.flatMap(f),
      Effect.flatMap(([b, a]) =>
        pipe(
          Ref.set(this.ref, a),
          Effect.as(b),
          Effect.zipLeft(Hub.publish(this.hub, a))
        )
      ),
      this.semaphore.withPermits(1)
    )
  }
}

/** @internal */
export const get = <A>(self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<never, never, A> => Ref.get(self.ref)

/** @internal */
export const make = <A>(value: A): Effect.Effect<never, never, SubscriptionRef.SubscriptionRef<A>> =>
  pipe(
    Effect.all([
      Hub.unbounded<A>(),
      Ref.make(value),
      Effect.makeSemaphore(1)
    ]),
    Effect.map(([hub, ref, semaphore]) => new SubscriptionRefImpl(ref, hub, semaphore))
  )

/** @internal */
export const modify = dual<
  <A, B>(f: (a: A) => readonly [B, A]) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<never, never, B>,
  <A, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => readonly [B, A]
  ) => Effect.Effect<never, never, B>
>(2, <A, B>(
  self: SubscriptionRef.SubscriptionRef<A>,
  f: (a: A) => readonly [B, A]
): Effect.Effect<never, never, B> => self.modify(f))

/** @internal */
export const modifyEffect = dual<
  <A, R, E, B>(
    f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
  ) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<R, E, B>,
  <A, R, E, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
  ) => Effect.Effect<R, E, B>
>(2, <A, R, E, B>(
  self: SubscriptionRef.SubscriptionRef<A>,
  f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
): Effect.Effect<R, E, B> => self.modifyEffect(f))

/** @internal */
export const set = dual<
  <A>(value: A) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<never, never, void>,
  <A>(
    self: SubscriptionRef.SubscriptionRef<A>,
    value: A
  ) => Effect.Effect<never, never, void>
>(2, <A>(
  self: SubscriptionRef.SubscriptionRef<A>,
  value: A
): Effect.Effect<never, never, void> =>
  pipe(
    Ref.set(self.ref, value),
    Effect.zipLeft(Hub.publish(self.hub, value)),
    self.semaphore.withPermits(1)
  ))
