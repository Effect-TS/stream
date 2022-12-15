/**
 * @since 1.0.0
 */
import type * as Cause from "@effect/io/Cause"
import type * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import type * as Channel from "@effect/stream/Channel"
import * as internal from "@effect/stream/internal/stream"
import type * as Sink from "@effect/stream/Sink"
import type * as Chunk from "@fp-ts/data/Chunk"
import type * as Either from "@fp-ts/data/Either"
import type { LazyArg } from "@fp-ts/data/Function"
import type * as Option from "@fp-ts/data/Option"

/**
 * @since 1.0.0
 * @category symbols
 */
export const StreamTypeId: unique symbol = internal.StreamTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type StreamTypeId = typeof StreamTypeId

/**
 * A `Stream<R, E, A>` is a description of a program that, when evaluated, may
 * emit zero or more values of type `A`, may fail with errors of type `E`, and
 * uses an environment of type `R`. One way to think of `Stream` is as a
 * `Effect` program that could emit multiple values.
 *
 * `Stream` is a purely functional *pull* based stream. Pull based streams offer
 * inherent laziness and backpressure, relieving users of the need to manage
 * buffers between operators. As an optimization, `Stream` does not emit
 * single values, but rather an array of values. This allows the cost of effect
 * evaluation to be amortized.
 *
 * `Stream` forms a monad on its `A` type parameter, and has error management
 * facilities for its `E` type parameter, modeled similarly to `Effect` (with
 * some adjustments for the multiple-valued nature of `Stream`). These aspects
 * allow for rich and expressive composition of streams.
 *
 * @since 1.0.0
 * @category models
 */
export interface Stream<R, E, A> extends Stream.Variance<R, E, A> {
  /** @internal */
  readonly channel: Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown>
}

/**
 * @since 1.0.0
 */
export declare namespace Stream {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<R, E, A> {
    readonly [StreamTypeId]: {
      _R: (_: never) => R
      _E: (_: never) => E
      _A: (_: never) => A
    }
  }
}

/**
 * The default chunk size used by the various combinators and constructors of
 * `Stream`.
 *
 * @since 1.0.0
 * @category constants
 */
export const DefaultChunkSize: number = internal.DefaultChunkSize

/**
 * Switches over to the stream produced by the provided function in case this
 * one fails with a typed error.
 *
 * @since 1.0.0
 * @category error handling
 */
export const catchAll: <E, R2, E2, A2>(
  f: (error: E) => Stream<R2, E2, A2>
) => <R, A>(self: Stream<R, E, A>) => Stream<R2 | R, E2, A2 | A> = internal.catchAll

/**
 * Switches over to the stream produced by the provided function in case this
 * one fails. Allows recovery from all causes of failure, including
 * interruption if the stream is uninterruptible.
 *
 * @since 1.0.0
 * @category error handling
 */
export const catchAllCause: <E, R2, E2, A2>(
  f: (cause: Cause.Cause<E>) => Stream<R2, E2, A2>
) => <R, A>(self: Stream<R, E, A>) => Stream<R2 | R, E2, A2 | A> = internal.catchAllCause

/**
 * Concatenates the specified stream with this stream, resulting in a stream
 * that emits the elements from this stream and then the elements from the
 * specified stream.
 *
 * @since 1.0.0
 * @category mutations
 */
export const concat: <R2, E2, A2>(
  that: Stream<R2, E2, A2>
) => <R, E, A>(self: Stream<R, E, A>) => Stream<R2 | R, E2 | E, A2 | A> = internal.concat

/**
 * Returns a stream whose failures and successes have been lifted into an
 * `Either`. The resulting stream cannot fail, because the failures have been
 * exposed as part of the `Either` success case.
 *
 * @note The stream will end as soon as the first error occurs.
 *
 * @since 1.0.0
 * @category mutations
 */
export const either: <R, E, A>(self: Stream<R, E, A>) => Stream<R, never, Either.Either<E, A>> = internal.either

/**
 * The empty stream.
 *
 * @since 1.0.0
 * @category constructors
 */
export const empty: Stream<never, never, never> = internal.empty

/**
 * Terminates with the specified error.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fail: <E>(error: E) => Stream<never, E, never> = internal.fail

/**
 * Terminates with the specified lazily evaluated error.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Stream<never, E, never> = internal.failSync

/**
 * The stream that always fails with the specified `Cause`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Stream<never, E, never> = internal.failCause

/**
 * The stream that always fails with the specified lazily evaluated `Cause`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failCauseSync: <E>(evaluate: LazyArg<Cause.Cause<E>>) => Stream<never, E, never> = internal.failCauseSync

/**
 * Returns a stream made of the concatenation in strict order of all the
 * streams produced by passing each element of this stream to `f0`
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatMap: <A, R2, E2, A2>(
  f: (a: A) => Stream<R2, E2, A2>
) => <R, E>(self: Stream<R, E, A>) => Stream<R2 | R, E2 | E, A2> = internal.flatMap

/**
 * Flattens this stream-of-streams into a stream made of the concatenation in
 * strict order of all the streams.
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatten: <R, E, R2, E2, A>(self: Stream<R, E, Stream<R2, E2, A>>) => Stream<R | R2, E | E2, A> =
  internal.flatten

/**
 * Creates a stream from a `Chunk` of values.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromChunk: <A>(chunk: Chunk.Chunk<A>) => Stream<never, never, A> = internal.fromChunk

/**
 * Creates a stream from an arbitrary number of chunks.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromChunks: <A>(...chunks: Array<Chunk.Chunk<A>>) => Stream<never, never, A> = internal.fromChunks

/**
 * Either emits the success value of this effect or terminates the stream
 * with the failure value of this effect.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromEffect: <R, E, A>(effect: Effect.Effect<R, E, A>) => Stream<R, E, A> = internal.fromEffect

/**
 * Creates a stream from an effect producing a value of type `A` or an empty
 * `Stream`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromEffectOption: <R, E, A>(effect: Effect.Effect<R, Option.Option<E>, A>) => Stream<R, E, A> =
  internal.fromEffectOption

/**
 * Creates a stream from an `Iterable` collection of values.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromIterable: <A>(iterable: Iterable<A>) => Stream<never, never, A> = internal.fromIterable

/**
 * Creates a stream from an effect producing a value of type `Iterable<A>`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromIterableEffect: <R, E, A>(effect: Effect.Effect<R, E, Iterable<A>>) => Stream<R, E, A> =
  internal.fromIterableEffect

/**
 * Creates a stream from an sequence of values.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: <As extends Array<any>>(...as: As) => Stream<never, never, As[number]> = internal.make

/**
 * Transforms the elements of this stream using the supplied function.
 *
 * @since 1.0.0
 * @category mapping
 */
export const map: <A, A2>(f: (a: A) => A2) => <R, E>(self: Stream<R, E, A>) => Stream<R, E, A2> = internal.map

/**
 * Maps over elements of the stream with the specified effectful function.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapEffect: <A, R2, E2, A2>(
  f: (a: A) => Effect.Effect<R2, E2, A2>
) => <R, E>(self: Stream<R, E, A>) => Stream<R2 | R, E2 | E, A2> = internal.mapEffect

/**
 * Transforms the errors emitted by this stream using `f`.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapError: <E, E2>(f: (error: E) => E2) => <R, A>(self: Stream<R, E, A>) => Stream<R, E2, A> =
  internal.mapError

/**
 * Transforms the full causes of failures emitted by this stream.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapErrorCause: <E, E2>(
  f: (cause: Cause.Cause<E>) => Cause.Cause<E2>
) => <R, A>(self: Stream<R, E, A>) => Stream<R, E2, A> = internal.mapErrorCause

/**
 * Peels off enough material from the stream to construct a `Z` using the
 * provided `Sink` and then returns both the `Z` and the rest of the
 * `Stream` in a scope. Like all scoped values, the provided stream is
 * valid only within the scope.
 *
 * @macro traced
 * @since 1.0.0
 * @category mutations
 */
export const peel: <R2, E2, A, Z>(
  sink: Sink.Sink<R2, E2, A, A, Z>
) => <R, E>(self: Stream<R, E, A>) => Effect.Effect<
  R | R2 | Scope.Scope,
  E | E2,
  readonly [Z, Stream<never, E, A>]
> = internal.peel

/**
 * Pipes all of the values from this stream through the provided sink.
 *
 * See also `Stream.transduce`.
 *
 * @since 1.0.0
 * @category mutations
 */
export const pipeThrough: <R2, E2, A, L, Z>(
  sink: Sink.Sink<R2, E2, A, L, Z>
) => <R, E>(self: Stream<R, E, A>) => Stream<R2 | R, E2 | E, L> = internal.pipeThrough

/**
 * Constructs a stream from a range of integers (lower bound included, upper
 * bound not included).
 *
 * @since 1.0.0
 * @category constructors
 */
export const range: (min: number, max: number, chunkSize?: number) => Stream<never, never, number> = internal.range

/**
 * Re-chunks the elements of the stream into chunks of `n` elements each. The
 * last chunk might contain less than `n` elements.
 *
 * @since 1.0.0
 * @category mutations
 */
export const rechunk: (n: number) => <R, E, A>(self: Stream<R, E, A>) => Stream<R, E, A> = internal.rechunk

/**
 * Runs the sink on the stream to produce either the sink's result or an error.
 *
 * @since 1.0.0
 * @category destructors
 */
export const run: <R2, E2, A, Z>(
  sink: Sink.Sink<R2, E2, A, unknown, Z>
) => <R, E>(self: Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, Z> = internal.run

/**
 * Runs the stream and collects all of its elements to a chunk.
 *
 * @since 1.0.0
 * @category destructors
 */
export const runCollect: <R, E, A>(self: Stream<R, E, A>) => Effect.Effect<R, E, Chunk.Chunk<A>> = internal.runCollect

/**
 * Returns a lazily constructed stream.
 *
 * @since 1.0.0
 * @category constructors
 */
export const suspend: <R, E, A>(stream: LazyArg<Stream<R, E, A>>) => Stream<R, E, A> = internal.suspend

/**
 * Returns a stream that effectfully "peeks" at the cause of failure of the
 * stream.
 *
 * @since 1.0.0
 * @category mutations
 */
export const tapErrorCause: <E, R2, E2, _>(
  f: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, _>
) => <R, A>(self: Stream<R, E, A>) => Stream<R2 | R, E | E2, A> = internal.tapErrorCause

/**
 * Applies the transducer to the stream and emits its outputs.
 *
 * @since 1.0.0
 * @category mutations
 */
export const transduce: <R2, E2, A, Z>(
  sink: Sink.Sink<R2, E2, A, A, Z>
) => <R, E>(self: Stream<R, E, A>) => Stream<R2 | R, E2 | E, Z> = internal.transduce

/**
 * Creates a stream produced from an `Effect`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const unwrap: <R, E, R2, E2, A>(effect: Effect.Effect<R, E, Stream<R2, E2, A>>) => Stream<R | R2, E | E2, A> =
  internal.unwrap
