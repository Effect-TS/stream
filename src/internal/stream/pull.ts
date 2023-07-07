import * as Chunk from "@effect/data/Chunk"
import * as Option from "@effect/data/Option"
import type * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Queue from "@effect/io/Queue"
import * as take from "@effect/stream/internal/take"
import type * as Take from "@effect/stream/Take"

/** @internal */
export interface Pull<R, E, A> extends Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>> {}

/** @internal */
export const emit = <A>(value: A): Effect.Effect<never, never, Chunk.Chunk<A>> => Effect.succeed(Chunk.of(value))

/** @internal */
export const emitChunk = <A>(chunk: Chunk.Chunk<A>): Effect.Effect<never, never, Chunk.Chunk<A>> =>
  Effect.succeed(chunk)

/** @internal */
export const empty = <A>(): Effect.Effect<never, never, Chunk.Chunk<A>> => Effect.succeed(Chunk.empty<A>())

/** @internal */
export const end = (): Effect.Effect<never, Option.Option<never>, never> => Effect.fail(Option.none())

/** @internal */
export const fail = <E>(error: E): Effect.Effect<never, Option.Option<E>, never> => Effect.fail(Option.some(error))

/** @internal */
export const failCause = <E>(cause: Cause.Cause<E>): Effect.Effect<never, Option.Option<E>, never> =>
  Effect.mapError(Effect.failCause(cause), Option.some)

/** @internal */
export const fromDequeue = <E, A>(
  dequeue: Queue.Dequeue<Take.Take<E, A>>
): Effect.Effect<never, Option.Option<E>, Chunk.Chunk<A>> => Effect.flatMap(Queue.take(dequeue), take.done)
