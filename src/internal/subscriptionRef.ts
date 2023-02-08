import { bodyWithTrace, dualWithTrace, methodWithTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Hub from "@effect/io/Hub"
import * as _circular from "@effect/io/internal_effect_untraced/effect/circular"
import * as _ref from "@effect/io/internal_effect_untraced/ref"
import * as Ref from "@effect/io/Ref"
import * as Synchronized from "@effect/io/Ref/Synchronized"
import * as stream from "@effect/stream/internal/stream"
import type { Stream } from "@effect/stream/Stream"
import type * as SubscriptionRef from "@effect/stream/SubscriptionRef"
import { pipe } from "@fp-ts/core/Function"

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
      this.semaphore.withPermits(1),
      stream.unwrapScoped
    )
  }
  /** @macro traced */
  modify<B>(f: (a: A) => readonly [B, A]): Effect.Effect<never, never, B> {
    return bodyWithTrace((trace) => this.modifyEffect((a) => Effect.succeed(f(a))).traced(trace))
  }
  /** @macro traced */
  modifyEffect<R, E, B>(f: (a: A) => Effect.Effect<R, E, readonly [B, A]>): Effect.Effect<R, E, B> {
    return bodyWithTrace((trace) =>
      pipe(
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
      ).traced(trace)
    )
  }
}

/** @internal */
export const get = methodWithTrace((trace) =>
  <A>(self: SubscriptionRef.SubscriptionRef<A>): Effect.Effect<never, never, A> => Ref.get(self.ref).traced(trace)
)

/** @internal */
export const make = methodWithTrace((trace) =>
  <A>(value: A): Effect.Effect<never, never, SubscriptionRef.SubscriptionRef<A>> =>
    pipe(
      Effect.tuple(
        Hub.unbounded<A>(),
        Ref.make(value),
        Effect.makeSemaphore(1)
      ),
      Effect.map(([hub, ref, semaphore]) => new SubscriptionRefImpl(ref, hub, semaphore))
    ).traced(trace)
)

/** @internal */
export const modify = dualWithTrace<
  <A, B>(f: (a: A) => readonly [B, A]) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<never, never, B>,
  <A, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => readonly [B, A]
  ) => Effect.Effect<never, never, B>
>(2, (trace) =>
  <A, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => readonly [B, A]
  ): Effect.Effect<never, never, B> => self.modify(f).traced(trace))

/** @internal */
export const modifyEffect = dualWithTrace<
  <A, R, E, B>(
    f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
  ) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<R, E, B>,
  <A, R, E, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
  ) => Effect.Effect<R, E, B>
>(2, (trace) =>
  <A, R, E, B>(
    self: SubscriptionRef.SubscriptionRef<A>,
    f: (a: A) => Effect.Effect<R, E, readonly [B, A]>
  ): Effect.Effect<R, E, B> => self.modifyEffect(f).traced(trace))

/** @internal */
export const set = dualWithTrace<
  <A>(value: A) => (self: SubscriptionRef.SubscriptionRef<A>) => Effect.Effect<never, never, void>,
  <A>(
    self: SubscriptionRef.SubscriptionRef<A>,
    value: A
  ) => Effect.Effect<never, never, void>
>(2, (trace) =>
  <A>(
    self: SubscriptionRef.SubscriptionRef<A>,
    value: A
  ): Effect.Effect<never, never, void> =>
    pipe(
      Ref.set(self.ref, value),
      Effect.zipLeft(Hub.publish(self.hub, value)),
      self.semaphore.withPermits(1)
    ).traced(trace))
