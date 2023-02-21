import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import { dualWithTrace, methodWithTrace } from "@effect/io/Debug"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"

/** @internal */
export const HandoffTypeId = Symbol.for("@effect/stream/Stream/Handoff")

/** @internal */
export type HandoffTypeId = typeof HandoffTypeId

/**
 * A synchronous queue-like abstraction that allows a producer to offer an
 * element and wait for it to be taken, and allows a consumer to wait for an
 * element to be available.
 *
 * @internal
 */
export interface Handoff<A> extends Handoff.Variance<A> {
  readonly ref: Ref.Ref<Handoff.State<A>>
}

/** @internal */
export const OP_HANDOFF_STATE_EMPTY = "Empty" as const

/** @internal */
export type OP_HANDOFF_STATE_EMPTY = typeof OP_HANDOFF_STATE_EMPTY

/** @internal */
export const OP_HANDOFF_STATE_FULL = "Full" as const

/** @internal */
export type OP_HANDOFF_STATE_FULL = typeof OP_HANDOFF_STATE_FULL

/** @internal */
export declare namespace Handoff {
  /** @internal */
  export interface Variance<A> {
    readonly [HandoffTypeId]: {
      readonly _A: (_: never) => A
    }
  }

  /** @internal */
  export type State<A> = Empty | Full<A>

  /** @internal */
  export interface Empty {
    readonly _tag: OP_HANDOFF_STATE_EMPTY
    readonly notifyConsumer: Deferred.Deferred<never, void>
  }

  /** @internal */
  export interface Full<A> {
    readonly _tag: OP_HANDOFF_STATE_FULL
    readonly value: A
    readonly notifyProducer: Deferred.Deferred<never, void>
  }
}

/** @internal */
const handoffStateEmpty = (notifyConsumer: Deferred.Deferred<never, void>): Handoff.State<never> => ({
  _tag: OP_HANDOFF_STATE_EMPTY,
  notifyConsumer
})

/** @internal */
const handoffStateFull = <A>(value: A, notifyProducer: Deferred.Deferred<never, void>): Handoff.State<A> => ({
  _tag: OP_HANDOFF_STATE_FULL,
  value,
  notifyProducer
})

/** @internal */
const handoffStateMatch = <A, Z>(
  onEmpty: (notifyConsumer: Deferred.Deferred<never, void>) => Z,
  onFull: (value: A, notifyProducer: Deferred.Deferred<never, void>) => Z
) => {
  return (self: Handoff.State<A>): Z => {
    switch (self._tag) {
      case OP_HANDOFF_STATE_EMPTY: {
        return onEmpty(self.notifyConsumer)
      }
      case OP_HANDOFF_STATE_FULL: {
        return onFull(self.value, self.notifyProducer)
      }
    }
  }
}

/** @internal */
const handoffVariance = {
  _A: (_: never) => _
}

/** @internal */
export const make = methodWithTrace((trace) =>
  <A>(): Effect.Effect<never, never, Handoff<A>> =>
    pipe(
      Deferred.make<never, void>(),
      Effect.flatMap((deferred) => Ref.make(handoffStateEmpty(deferred))),
      Effect.map((ref) => ({
        [HandoffTypeId]: handoffVariance,
        ref
      }))
    ).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const offer = dualWithTrace<
  <A>(value: A) => (self: Handoff<A>) => Effect.Effect<never, never, void>,
  <A>(self: Handoff<A>, value: A) => Effect.Effect<never, never, void>
>(2, (trace) =>
  (
    self,
    value
  ): Effect.Effect<never, never, void> => {
    return pipe(
      Deferred.make<never, void>(),
      Effect.flatMap((deferred) =>
        pipe(
          Ref.modify(self.ref, (state) =>
            pipe(
              state,
              handoffStateMatch(
                (notifyConsumer) => [
                  pipe(
                    Deferred.succeed<never, void>(notifyConsumer, void 0),
                    Effect.zipRight(Deferred.await(deferred))
                  ),
                  handoffStateFull(value, deferred)
                ],
                (_, notifyProducer) => [
                  pipe(Deferred.await(notifyProducer), Effect.flatMap(() => pipe(self, offer(value)))),
                  state
                ]
              )
            )),
          Effect.flatten
        )
      )
    ).traced(trace)
  })

/**
 * @macro traced
 * @since 1.0.0
 */
export const take = methodWithTrace((trace) =>
  <A>(self: Handoff<A>): Effect.Effect<never, never, A> =>
    pipe(
      Deferred.make<never, void>(),
      Effect.flatMap((deferred) =>
        pipe(
          Ref.modify(self.ref, (state) =>
            pipe(
              state,
              handoffStateMatch(
                (notifyConsumer) => [
                  pipe(Deferred.await(notifyConsumer), Effect.flatMap(() => take(self))),
                  state
                ],
                (value, notifyProducer) => [
                  pipe(Deferred.succeed<never, void>(notifyProducer, void 0), Effect.as(value)),
                  handoffStateEmpty(deferred)
                ]
              )
            )),
          Effect.flatten
        )
      )
    ).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const poll = methodWithTrace((trace) =>
  <A>(self: Handoff<A>): Effect.Effect<never, never, Option.Option<A>> =>
    pipe(
      Deferred.make<never, void>(),
      Effect.flatMap((deferred) =>
        pipe(
          Ref.modify(self.ref, (state) =>
            pipe(
              state,
              handoffStateMatch(
                () => [
                  Effect.succeed(Option.none() as Option.Option<A>),
                  state
                ],
                (value, notifyProducer) => [
                  pipe(Deferred.succeed<never, void>(notifyProducer, void 0), Effect.as(Option.some(value))),
                  handoffStateEmpty(deferred)
                ]
              )
            )),
          Effect.flatten
        )
      )
    ).traced(trace)
)
