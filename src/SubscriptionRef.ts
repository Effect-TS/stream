/**
 * @since 1.0.0
 */
import type * as Effect from "@effect/io/Effect"
import type * as Hub from "@effect/io/Hub"
import * as Ref from "@effect/io/Ref"
import * as Synchronized from "@effect/io/Ref/Synchronized"
import * as internal from "@effect/stream/internal/subscriptionRef"
import type * as Stream from "@effect/stream/Stream"
import type * as Option from "@effect/data/Option"

/**
 * @since 1.0.0
 * @category symbols
 */
export const SubscriptionRefTypeId: unique symbol = internal.SubscriptionRefTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type SubscriptionRefTypeId = typeof SubscriptionRefTypeId

/**
 * A `SubscriptionRef<A>` is a `Ref` that can be subscribed to in order to
 * receive the current value as well as all changes to the value.
 *
 * @since 1.0.0
 * @category models
 */
export interface SubscriptionRef<A> extends SubscriptionRef.Variance<A>, Synchronized.Synchronized<A> {
  /** @internal */
  readonly ref: Ref.Ref<A>
  /** @internal */
  readonly hub: Hub.Hub<A>
  /** @internal */
  readonly semaphore: Effect.Semaphore
  /**
   * A stream containing the current value of the `Ref` as well as all changes
   * to that value.
   */
  readonly changes: Stream.Stream<never, never, A>
}

/**
 * @since 1.0.0
 */
export declare namespace SubscriptionRef {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<A> {
    readonly [SubscriptionRefTypeId]: {
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @macro traced
 * @since 1.0.0
 * @category getters
 */
export const get: <A>(self: SubscriptionRef<A>) => Effect.Effect<never, never, A> = internal.get

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const getAndSet: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<never, never, A>
} = Ref.getAndSet

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdate: {
  <A>(f: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, f: (a: A) => A): Effect.Effect<never, never, A>
} = Ref.getAndUpdate

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdateEffect: {
  <A, R, E>(f: (a: A) => Effect.Effect<R, E, A>): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, A>
  <A, R, E>(self: Synchronized.Synchronized<A>, f: (a: A) => Effect.Effect<R, E, A>): Effect.Effect<R, E, A>
} = Synchronized.getAndUpdateEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdateSome: {
  <A>(pf: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, pf: (a: A) => Option.Option<A>): Effect.Effect<never, never, A>
} = Ref.getAndUpdateSome

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const getAndUpdateSomeEffect: {
  <A, R, E>(
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, A>
  <A, R, E>(
    self: Synchronized.Synchronized<A>,
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): Effect.Effect<R, E, A>
} = Synchronized.getAndUpdateSomeEffect

/**
 * Creates a new `SubscriptionRef` with the specified value.
 *
 * @macro traced
 * @since 1.0.0
 * @category constructors
 */
export const make: <A>(value: A) => Effect.Effect<never, never, SubscriptionRef<A>> = internal.make

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const modify: {
  <A, B>(f: (a: A) => readonly [B, A]): (self: SubscriptionRef<A>) => Effect.Effect<never, never, B>
  <A, B>(self: SubscriptionRef<A>, f: (a: A) => readonly [B, A]): Effect.Effect<never, never, B>
} = internal.modify

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const modifyEffect: {
  <A, R, E, B>(f: (a: A) => Effect.Effect<R, E, readonly [B, A]>): (self: SubscriptionRef<A>) => Effect.Effect<R, E, B>
  <A, R, E, B>(self: SubscriptionRef<A>, f: (a: A) => Effect.Effect<R, E, readonly [B, A]>): Effect.Effect<R, E, B>
} = internal.modifyEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const modifySome: {
  <B, A>(
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ): (self: SubscriptionRef<A>) => Effect.Effect<never, never, B>
  <A, B>(
    self: SubscriptionRef<A>,
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ): Effect.Effect<never, never, B>
} = Ref.modifySome

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const modifySomeEffect: {
  <A, B, R, E>(
    fallback: B,
    pf: (a: A) => Option.Option<Effect.Effect<R, E, readonly [B, A]>>
  ): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, B>
  <A, B, R, E>(
    self: Synchronized.Synchronized<A>,
    fallback: B,
    pf: (a: A) => Option.Option<Effect.Effect<R, E, readonly [B, A]>>
  ): Effect.Effect<R, E, B>
} = Synchronized.modifySomeEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const set: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, void>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<never, never, void>
} = internal.set

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const setAndGet: {
  <A>(value: A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, value: A): Effect.Effect<never, never, A>
} = Ref.setAndGet

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const update: {
  <A>(f: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, void>
  <A>(self: SubscriptionRef<A>, f: (a: A) => A): Effect.Effect<never, never, void>
} = Ref.update

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateEffect: {
  <A, R, E>(f: (a: A) => Effect.Effect<R, E, A>): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, void>
  <A, R, E>(self: Synchronized.Synchronized<A>, f: (a: A) => Effect.Effect<R, E, A>): Effect.Effect<R, E, void>
} = Synchronized.updateEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateAndGet: {
  <A>(f: (a: A) => A): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, f: (a: A) => A): Effect.Effect<never, never, A>
} = Ref.updateAndGet

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateAndGetEffect: {
  <A, R, E>(f: (a: A) => Effect.Effect<R, E, A>): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, A>
  <A, R, E>(self: Synchronized.Synchronized<A>, f: (a: A) => Effect.Effect<R, E, A>): Effect.Effect<R, E, A>
} = Synchronized.updateAndGetEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateSome: {
  <A>(f: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<never, never, void>
  <A>(self: SubscriptionRef<A>, f: (a: A) => Option.Option<A>): Effect.Effect<never, never, void>
} = Ref.updateSome

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateSomeEffect: {
  <A, R, E>(
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): (self: SubscriptionRef<A>) => Effect.Effect<R, E, void>
  <A, R, E>(
    self: Synchronized.Synchronized<A>,
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): Effect.Effect<R, E, void>
} = Synchronized.updateSomeEffect

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateSomeAndGet: {
  <A>(pf: (a: A) => Option.Option<A>): (self: SubscriptionRef<A>) => Effect.Effect<never, never, A>
  <A>(self: SubscriptionRef<A>, pf: (a: A) => Option.Option<A>): Effect.Effect<never, never, A>
} = Ref.updateSomeAndGet

/**
 * @macro traced
 * @since 1.0.0
 * @category utils
 */
export const updateSomeAndGetEffect: {
  <A, R, E>(
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): (self: Synchronized.Synchronized<A>) => Effect.Effect<R, E, A>
  <A, R, E>(
    self: Synchronized.Synchronized<A>,
    pf: (a: A) => Option.Option<Effect.Effect<R, E, A>>
  ): Effect.Effect<R, E, A>
} = Synchronized.updateSomeAndGetEffect
