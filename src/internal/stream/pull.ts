import * as Chunk from "@effect/data/Chunk"
import type * as Cause from "@effect/io/Cause"
import { methodWithTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Queue from "@effect/io/Queue"
import * as take from "@effect/stream/internal/take"
import type * as Take from "@effect/stream/Take"
import { pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"

/** @internal */
export interface Pull<R, E, A> extends Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>> {}

/**
 * @macro traced
 * @internal
 */
export const emit = methodWithTrace((trace) =>
  <A>(value: A): Effect.Effect<never, never, Chunk.Chunk<A>> => Effect.succeed(Chunk.of(value)).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const emitChunk = methodWithTrace((trace) =>
  <A>(chunk: Chunk.Chunk<A>): Effect.Effect<never, never, Chunk.Chunk<A>> => Effect.succeed(chunk).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const empty = methodWithTrace((trace) =>
  <A>(): Effect.Effect<never, never, Chunk.Chunk<A>> => Effect.succeed(Chunk.empty<A>()).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const end = methodWithTrace((trace) =>
  (): Effect.Effect<never, Option.Option<never>, never> => Effect.fail(Option.none()).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const fail = methodWithTrace((trace) =>
  <E>(error: E): Effect.Effect<never, Option.Option<E>, never> => Effect.fail(Option.some(error)).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const failCause = methodWithTrace((trace) =>
  <E>(cause: Cause.Cause<E>): Effect.Effect<never, Option.Option<E>, never> =>
    pipe(Effect.failCause(cause), Effect.mapError(Option.some)).traced(trace)
)

/**
 * @macro traced
 * @internal
 */
export const fromDequeue = methodWithTrace((trace) =>
  <E, A>(
    dequeue: Queue.Dequeue<Take.Take<E, A>>
  ): Effect.Effect<never, Option.Option<E>, Chunk.Chunk<A>> =>
    pipe(Queue.take(dequeue), Effect.flatMap(take.done)).traced(trace)
)
