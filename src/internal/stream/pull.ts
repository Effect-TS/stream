import type * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Queue from "@effect/io/Queue"
import * as take from "@effect/stream/internal/take"
import type * as Take from "@effect/stream/Take"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

/** @internal */
export interface Pull<R, E, A> extends Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>> {}

/**
 * @macro traced
 * @internal
 */
export const emit = <A>(value: A): Effect.Effect<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return Effect.succeed(Chunk.of(value)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const emitChunk = <A>(chunk: Chunk.Chunk<A>): Effect.Effect<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return Effect.succeed(chunk).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const empty = <A>(): Effect.Effect<never, never, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return Effect.succeed(Chunk.empty<A>()).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const end = (): Effect.Effect<never, Option.Option<never>, never> => {
  const trace = getCallTrace()
  return Effect.fail(Option.none).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fail = <E>(error: E): Effect.Effect<never, Option.Option<E>, never> => {
  const trace = getCallTrace()
  return Effect.fail(Option.some(error)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const failCause = <E>(cause: Cause.Cause<E>): Effect.Effect<never, Option.Option<E>, never> => {
  const trace = getCallTrace()
  return pipe(Effect.failCause(cause), Effect.mapError(Option.some)).traced(trace)
}

/**
 * @macro traced
 * @internal
 */
export const fromDequeue = <E, A>(
  dequeue: Queue.Dequeue<Take.Take<E, A>>
): Effect.Effect<never, Option.Option<E>, Chunk.Chunk<A>> => {
  const trace = getCallTrace()
  return pipe(Queue.take(dequeue), Effect.flatMap(take.done)).traced(trace)
}
