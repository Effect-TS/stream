/**
 * @since 1.0.0
 */
import type * as Cause from "@effect/io/Cause"
import type * as Deferred from "@effect/io/Deferred"
import type * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import type * as Hub from "@effect/io/Hub"
import type * as Layer from "@effect/io/Layer"
import type * as Queue from "@effect/io/Queue"
import type * as Ref from "@effect/io/Ref"
import type * as Scope from "@effect/io/Scope"
import type * as ChildExecutorDecision from "@effect/stream/Channel/ChildExecutorDecision"
import type * as MergeDecision from "@effect/stream/Channel/MergeDecision"
import type * as MergeStrategy from "@effect/stream/Channel/MergeStrategy"
import type * as SingleProducerAsyncInput from "@effect/stream/Channel/SingleProducerAsyncInput"
import type * as UpstreamPullRequest from "@effect/stream/Channel/UpstreamPullRequest"
import type * as UpstreamPullStrategy from "@effect/stream/Channel/UpstreamPullStrategy"
import * as channel from "@effect/stream/internal/channel"
import * as core from "@effect/stream/internal/core"
import * as sink from "@effect/stream/internal/sink"
import * as stream from "@effect/stream/internal/stream"
import type * as Sink from "@effect/stream/Sink"
import type * as Stream from "@effect/stream/Stream"
import type * as Chunk from "@fp-ts/data/Chunk"
import type * as Context from "@fp-ts/data/Context"
import type * as Either from "@fp-ts/data/Either"
import type { LazyArg } from "@fp-ts/data/Function"
import type * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/**
 * @since 1.0.0
 * @category symbols
 */
export const ChannelTypeId: unique symbol = core.ChannelTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type ChannelTypeId = typeof ChannelTypeId

/**
 * A `Channel` is a nexus of I/O operations, which supports both reading and
 * writing. A channel may read values of type `InElem` and write values of type
 * `OutElem`. When the channel finishes, it yields a value of type `OutDone`. A
 * channel may fail with a value of type `OutErr`.
 *
 * Channels are the foundation of Streams: both streams and sinks are built on
 * channels. Most users shouldn't have to use channels directly, as streams and
 * sinks are much more convenient and cover all common use cases. However, when
 * adding new stream and sink operators, or doing something highly specialized,
 * it may be useful to use channels directly.
 *
 * Channels compose in a variety of ways:
 *
 *  - **Piping**: One channel can be piped to another channel, assuming the
 *    input type of the second is the same as the output type of the first.
 *  - **Sequencing**: The terminal value of one channel can be used to create
 *    another channel, and both the first channel and the function that makes
 *    the second channel can be composed into a channel.
 *  - **Concatenating**: The output of one channel can be used to create other
 *    channels, which are all concatenated together. The first channel and the
 *    function that makes the other channels can be composed into a channel.
 *
 * @since 1.0.0
 * @category models
 */
export interface Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  extends Channel.Variance<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
{}

/**
 * @since 1.0.0
 */
export declare namespace Channel {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> {
    readonly [ChannelTypeId]: {
      _Env: (_: never) => Env
      _InErr: (_: InErr) => void
      _InElem: (_: InElem) => void
      _InDone: (_: InDone) => void
      _OutErr: (_: never) => OutErr
      _OutElem: (_: never) => OutElem
      _OutDone: (_: never) => OutDone
    }
  }
}

/**
 * @since 1.0.0
 * @category symbols
 */
export const ChannelExceptionTypeId: unique symbol = channel.ChannelExceptionTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type ChannelExceptionTypeId = typeof ChannelExceptionTypeId

/**
 * Represents a generic checked exception which occurs when a `Channel` is
 * executed.
 *
 * @since 1.0.0
 * @category models
 */
export interface ChannelException<E> {
  readonly _tag: "ChannelException"
  readonly [ChannelExceptionTypeId]: ChannelExceptionTypeId
  readonly error: E
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const acquireUseRelease: <Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone, Acquired>(
  acquire: Effect.Effect<Env, OutErr, Acquired>,
  use: (a: Acquired) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone>,
  release: (a: Acquired, exit: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env, never, any>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone> = channel.acquireUseRelease

/**
 * @since 1.0.0
 * @category constructors
 */
export const acquireReleaseOut: <R, R2, E, Z>(
  self: Effect.Effect<R, E, Z>,
  release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, unknown>
) => Channel<R | R2, unknown, unknown, unknown, E, Z, void> = core.acquireReleaseOut

/**
 * Returns a new channel that is the same as this one, except the terminal
 * value of the channel is the specified constant value.
 *
 * This method produces the same result as mapping this channel to the
 * specified constant value.
 *
 * @since 1.0.0
 * @category mapping
 */
export const as: <OutDone2>(
  value: OutDone2
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> = channel.as

/**
 * @since 1.0.0
 * @category mapping
 */
export const asUnit: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, void> = channel.asUnit

/**
 * Creates a channel backed by a buffer. When the buffer is empty, the channel
 * will simply passthrough its input as output. However, when the buffer is
 * non-empty, the value inside the buffer will be passed along as output.
 *
 * @since 1.0.0
 * @category constructors
 */
export const buffer: <InErr, InElem, InDone>(
  empty: InElem,
  isEmpty: Predicate<InElem>,
  ref: Ref.Ref<InElem>
) => Channel<never, InErr, InElem, InDone, InErr, InElem, InDone> = channel.buffer

/**
 * @since 1.0.0
 * @category constructors
 */
export const bufferChunk: <InErr, InElem, InDone>(
  ref: Ref.Ref<Chunk.Chunk<InElem>>
) => Channel<never, InErr, Chunk.Chunk<InElem>, InDone, InErr, Chunk.Chunk<InElem>, InDone> = channel.bufferChunk

/**
 * Returns a new channel that is the same as this one, except if this channel
 * errors for any typed error, then the returned channel will switch over to
 * using the fallback channel returned by the specified error handler.
 *
 * @since 1.0.0
 * @category error handling
 */
export const catchAll: <Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
  f: (error: OutErr) => Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1,
  OutElem1 | OutElem,
  OutDone1 | OutDone
> = channel.catchAll

/**
 * Returns a new channel that is the same as this one, except if this channel
 * errors for any typed error, then the returned channel will switch over to
 * using the fallback channel returned by the specified error handler.
 *
 * @since 1.0.0
 * @category error handling
 */
export const catchAllCause: <Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
  f: (cause: Cause.Cause<OutErr>) => Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1,
  OutElem1 | OutElem,
  OutDone1 | OutDone
> = core.catchAllCause

/**
 * Concat sequentially a channel of channels.
 *
 * @since 1.0.0
 * @category constructors
 */
export const concatAll: <Env, InErr, InElem, InDone, OutErr, OutElem>(
  channels: Channel<Env, InErr, InElem, InDone, OutErr, Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any>, any>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any> = core.concatAll

/**
 * Concat sequentially a channel of channels.
 *
 * @since 1.0.0
 * @category constructors
 */
export const concatAllWith: <
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  OutElem,
  OutDone,
  OutDone2,
  OutDone3,
  Env2,
  InErr2,
  InElem2,
  InDone2,
  OutErr2
>(
  channels: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem, OutDone>,
    OutDone2
  >,
  f: (o: OutDone, o1: OutDone) => OutDone,
  g: (o: OutDone, o2: OutDone2) => OutDone3
) => Channel<Env | Env2, InErr & InErr2, InElem & InElem2, InDone & InDone2, OutErr | OutErr2, OutElem, OutDone3> =
  core.concatAllWith

/**
 * Returns a new channel whose outputs are fed to the specified factory
 * function, which creates new channels in response. These new channels are
 * sequentially concatenated together, and all their outputs appear as outputs
 * of the newly returned channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const concatMap: <OutElem, OutElem2, Env2, InErr2, InElem2, InDone2, OutErr2, _>(
  f: (o: OutElem) => Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, _>
) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env2 | Env, InErr & InErr2, InElem & InElem2, InDone & InDone2, OutErr2 | OutErr, OutElem2, unknown> =
  channel.concatMap

/**
 * Returns a new channel whose outputs are fed to the specified factory
 * function, which creates new channels in response. These new channels are
 * sequentially concatenated together, and all their outputs appear as outputs
 * of the newly returned channel. The provided merging function is used to
 * merge the terminal values of all channels into the single terminal value of
 * the returned channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const concatMapWith: <OutElem, OutElem2, OutDone, OutDone2, OutDone3, Env2, InErr2, InElem2, InDone2, OutErr2>(
  f: (o: OutElem) => Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
  g: (o: OutDone, o1: OutDone) => OutDone,
  h: (o: OutDone, o2: OutDone2) => OutDone3
) => <Env, InErr, InElem, InDone, OutErr>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
) => Channel<Env2 | Env, InErr & InErr2, InElem & InElem2, InDone & InDone2, OutErr2 | OutErr, OutElem2, OutDone3> =
  core.concatMapWith

/**
 * Returns a new channel whose outputs are fed to the specified factory
 * function, which creates new channels in response. These new channels are
 * sequentially concatenated together, and all their outputs appear as outputs
 * of the newly returned channel. The provided merging function is used to
 * merge the terminal values of all channels into the single terminal value of
 * the returned channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const concatMapWithCustom: <
  OutElem,
  OutElem2,
  OutDone,
  OutDone2,
  OutDone3,
  Env2,
  InErr2,
  InElem2,
  InDone2,
  OutErr2
>(
  f: (o: OutElem) => Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
  g: (o: OutDone, o1: OutDone) => OutDone,
  h: (o: OutDone, o2: OutDone2) => OutDone3,
  onPull: (
    upstreamPullRequest: UpstreamPullRequest.UpstreamPullRequest<OutElem>
  ) => UpstreamPullStrategy.UpstreamPullStrategy<OutElem2>,
  onEmit: (elem: OutElem2) => ChildExecutorDecision.ChildExecutorDecision
) => <Env, InErr, InElem, InDone, OutErr>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
) => Channel<Env2 | Env, InErr & InErr2, InElem & InElem2, InDone & InDone2, OutErr2 | OutErr, OutElem2, OutDone3> =
  core.concatMapWithCustom

/**
 * Returns a new channel, which is the same as this one, except its outputs
 * are filtered and transformed by the specified partial function.
 *
 * @since 1.0.0
 * @category utils
 */
export const collect: <Env, InErr, InElem, InDone, OutErr, OutElem, OutElem2, OutDone>(
  pf: (o: OutElem) => Option.Option<OutElem2>
) => (
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> = channel.collect

/**
 * Returns a new channel, which is the concatenation of all the channels that
 * are written out by this channel. This method may only be called on channels
 * that output other channels.
 *
 * @since 1.0.0
 * @category utils
 */
export const concatOut: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown>,
    OutDone
  >
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown> = channel.concatOut

/**
 * Returns a new channel which is the same as this one but applies the given
 * function to the input channel's done value.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramap: <InDone0, InDone>(
  f: (a: InDone0) => InDone
) => <Env, InErr, InElem, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone> = channel.contramap

/**
 * Returns a new channel which is the same as this one but applies the given
 * effectual function to the input channel's done value.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramapEffect: <Env1, InErr, InDone0, InDone>(
  f: (i: InDone0) => Effect.Effect<Env1, InErr, InDone>
) => <Env, InElem, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone> = channel.contramapEffect

/**
 * Returns a new channel which is the same as this one but applies the given
 * function to the input channel's error value.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramapError: <InErr0, InErr>(
  f: (a: InErr0) => InErr
) => <Env, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone> = channel.contramapError

/**
 * Returns a new channel which is the same as this one but applies the given
 * effectual function to the input channel's error value.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramapErrorEffect: <Env1, InErr0, InErr, InDone>(
  f: (error: InErr0) => Effect.Effect<Env1, InErr, InDone>
) => <Env, InElem, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone> = channel.contramapErrorEffect

/**
 * Returns a new channel which is the same as this one but applies the given
 * function to the input channel's output elements.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramapIn: <InElem0, InElem>(
  f: (a: InElem0) => InElem
) => <Env, InErr, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone> = channel.contramapIn

/**
 * Returns a new channel which is the same as this one but applies the given
 * effectual function to the input channel's output elements.
 *
 * @since 1.0.0
 * @category utils
 */
export const contramapInEffect: <Env1, InErr, InElem0, InElem>(
  f: (a: InElem0) => Effect.Effect<Env1, InErr, InElem>
) => <Env, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone> = channel.contramapInEffect

/**
 * Returns a new channel, which is the same as this one, except that all the
 * outputs are collected and bundled into a tuple together with the terminal
 * value of this channel.
 *
 * As the channel returned from this channel collects all of this channel's
 * output into an in- memory chunk, it is not safe to call this method on
 * channels that output a large or unbounded number of values.
 *
 * @since 1.0.0
 * @category utils
 */
export const doneCollect: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, never, readonly [Chunk.Chunk<OutElem>, OutDone]> = channel.doneCollect

/**
 * Returns a new channel which reads all the elements from upstream's output
 * channel and ignores them, then terminates with the upstream result value.
 *
 * @since 1.0.0
 * @category utils
 */
export const drain: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, never, OutDone> = channel.drain

/**
 * Returns a new channel which connects the given `AsyncInputProducer` as
 * this channel's input.
 *
 * @since 1.0.0
 * @category utils
 */
export const embedInput: <InErr, InElem, InDone>(
  input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
) => <Env, OutErr, OutElem, OutDone>(
  self: Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> = core.embedInput

/**
 * Returns a new channel that collects the output and terminal value of this
 * channel, which it then writes as output of the returned channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const emitCollect: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone], void> = channel.emitCollect

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @since 1.0.0
 * @category utils
 */
export const ensuring: <Env1, Z>(
  finalizer: Effect.Effect<Env1, never, Z>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.ensuring

/**
 * Returns a new channel with an attached finalizer. The finalizer is
 * guaranteed to be executed so long as the channel begins execution (and
 * regardless of whether or not it completes).
 *
 * @since 1.0.0
 * @category utils
 */
export const ensuringWith: <Env2, OutErr, OutDone>(
  finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
) => <Env, InErr, InElem, InDone, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env2 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> = core.ensuringWith

/**
 * Accesses the whole environment of the channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const environment: <Env>() => Channel<Env, unknown, unknown, unknown, never, never, Context.Context<Env>> =
  channel.environment

/**
 * Accesses the environment of the channel with the specified function.
 *
 * @since 1.0.0
 * @category environment
 */
export const environmentWith: <Env, OutDone>(
  f: (env: Context.Context<Env>) => OutDone
) => Channel<Env, unknown, unknown, unknown, never, never, OutDone> = channel.environmentWith

/**
 * Accesses the environment of the channel in the context of a channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const environmentWithChannel: <Env, Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  f: (env: Context.Context<Env>) => Channel<Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env | Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.environmentWithChannel

/**
 * Accesses the environment of the channel in the context of an effect.
 *
 * @since 1.0.0
 * @category environment
 */
export const environmentWithEffect: <Env, Env1, OutErr, OutDone>(
  f: (env: Context.Context<Env>) => Effect.Effect<Env1, OutErr, OutDone>
) => Channel<Env | Env1, unknown, unknown, unknown, OutErr, never, OutDone> = channel.environmentWithEffect

/**
 * Constructs a channel that fails immediately with the specified error.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fail: <E>(error: E) => Channel<never, unknown, unknown, unknown, E, never, never> = core.fail

/**
 * Constructs a channel that succeeds immediately with the specified lazily
 * evaluated value.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failSync: <E>(evaluate: LazyArg<E>) => Channel<never, unknown, unknown, unknown, E, never, never> =
  core.failSync

/**
 * Constructs a channel that fails immediately with the specified `Cause`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failCause: <E>(cause: Cause.Cause<E>) => Channel<never, unknown, unknown, unknown, E, never, never> =
  core.failCause

/**
 * Constructs a channel that succeeds immediately with the specified lazily
 * evaluated `Cause`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const failCauseSync: <E>(
  evaluate: LazyArg<Cause.Cause<E>>
) => Channel<never, unknown, unknown, unknown, E, never, never> = core.failCauseSync

/**
 * Returns a new channel, which sequentially combines this channel, together
 * with the provided factory function, which creates a second channel based on
 * the terminal value of this channel. The result is a channel that will first
 * perform the functions of this channel, before performing the functions of
 * the created channel (including yielding its terminal value).
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatMap: <OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>(
  f: (d: OutDone) => Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  OutDone2
> = core.flatMap

/**
 * Returns a new channel, which flattens the terminal value of this channel.
 * This function may only be called if the terminal value of this channel is
 * another channel of compatible types.
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatten: <
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  OutElem,
  Env1,
  InErr1,
  InElem1,
  InDone1,
  OutErr1,
  OutElem1,
  OutDone2
>(
  self: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    OutElem,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
  >
) => Channel<
  Env | Env1,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr | OutErr1,
  OutElem | OutElem1,
  OutDone2
> = channel.flatten

/**
 * Folds over the result of this channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const foldChannel: <
  Env1,
  Env2,
  InErr1,
  InErr2,
  InElem1,
  InElem2,
  InDone1,
  InDone2,
  OutErr,
  OutErr1,
  OutErr2,
  OutElem1,
  OutElem2,
  OutDone,
  OutDone1,
  OutDone2
>(
  onError: (oErr: OutErr) => Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
  onSuccess: (oErr: OutDone) => Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone2>
) => <Env, InErr, InElem, InDone, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env2 | Env,
  InErr & InErr1 & InErr2,
  InElem & InElem1 & InElem2,
  InDone & InDone1 & InDone2,
  OutErr1 | OutErr2,
  OutElem1 | OutElem2 | OutElem,
  OutDone1 | OutDone2
> = channel.foldChannel

/**
 * Folds over the result of this channel including any cause of termination.
 *
 * @since 1.0.0
 * @category utils
 */
export const foldCauseChannel: <
  Env1,
  Env2,
  InErr1,
  InErr2,
  InElem1,
  InElem2,
  InDone1,
  InDone2,
  OutErr,
  OutErr2,
  OutErr3,
  OutElem1,
  OutElem2,
  OutDone,
  OutDone2,
  OutDone3
>(
  onError: (c: Cause.Cause<OutErr>) => Channel<Env1, InErr1, InElem1, InDone1, OutErr2, OutElem1, OutDone2>,
  onSuccess: (o: OutDone) => Channel<Env2, InErr2, InElem2, InDone2, OutErr3, OutElem2, OutDone3>
) => <Env, InErr, InElem, InDone, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env2 | Env,
  InErr & InErr1 & InErr2,
  InElem & InElem1 & InElem2,
  InDone & InDone1 & InDone2,
  OutErr2 | OutErr3,
  OutElem1 | OutElem2 | OutElem,
  OutDone2 | OutDone3
> = core.foldCauseChannel

/**
 * Use an effect to end a channel.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromEffect: <R, E, A>(
  effect: Effect.Effect<R, E, A>
) => Channel<R, unknown, unknown, unknown, E, never, A> = core.fromEffect

/**
 * Constructs a channel from an `Either`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromEither: <E, A>(either: Either.Either<E, A>) => Channel<never, unknown, unknown, unknown, E, never, A> =
  channel.fromEither

/**
 * Construct a `Channel` from an `AsyncInputConsumer`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromInput: <Err, Elem, Done>(
  input: SingleProducerAsyncInput.AsyncInputConsumer<Err, Elem, Done>
) => Channel<never, unknown, unknown, unknown, Err, Elem, Done> = channel.fromInput

/**
 * Construct a `Channel` from a `Hub`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromHub: <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
) => Channel<never, unknown, unknown, unknown, Err, Elem, Done> = channel.fromHub

/**
 * Construct a `Channel` from a `Hub` within a scoped effect.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromHubScoped: <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
) => Effect.Effect<Scope.Scope, never, Channel<never, unknown, unknown, unknown, Err, Elem, Done>> =
  channel.fromHubScoped

/**
 * Construct a `Channel` from an `Option`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromOption: <A>(
  option: Option.Option<A>
) => Channel<never, unknown, unknown, unknown, Option.Option<never>, never, A> = channel.fromOption

/**
 * Construct a `Channel` from a `Queue`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromQueue: <Err, Elem, Done>(
  queue: Queue.Dequeue<Either.Either<Exit.Exit<Err, Done>, Elem>>
) => Channel<never, unknown, unknown, unknown, Err, Elem, Done> = channel.fromQueue

/**
 * @since 1.0.0
 * @category constructors
 */
export const identity: <Err, Elem, Done>() => Channel<never, Err, Elem, Done, Err, Elem, Done> = channel.identityChannel

/**
 * Returns a new channel, which is the same as this one, except it will be
 * interrupted when the specified effect completes. If the effect completes
 * successfully before the underlying channel is done, then the returned
 * channel will yield the success value of the effect as its terminal value.
 * On the other hand, if the underlying channel finishes first, then the
 * returned channel will yield the success value of the underlying channel as
 * its terminal value.
 *
 * @since 1.0.0
 * @category utils
 */
export const interruptWhen: <Env1, OutErr1, OutDone1>(
  effect: Effect.Effect<Env1, OutErr1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone> = channel.interruptWhen

/**
 * Returns a new channel, which is the same as this one, except it will be
 * interrupted when the specified deferred is completed. If the deferred is
 * completed before the underlying channel is done, then the returned channel
 * will yield the value of the deferred. Otherwise, if the underlying channel
 * finishes first, then the returned channel will yield the value of the
 * underlying channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const interruptWhenDeferred: <OutErr1, OutDone1>(
  deferred: Deferred.Deferred<OutErr1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone> = channel.interruptWhenDeferred

/**
 * Returns a new channel, which is the same as this one, except the terminal
 * value of the returned channel is created by applying the specified function
 * to the terminal value of this channel.
 *
 * @since 1.0.0
 * @category mapping
 */
export const map: <OutDone, OutDone2>(
  f: (out: OutDone) => OutDone2
) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> = channel.map

/**
 * Returns a new channel, which is the same as this one, except the terminal
 * value of the returned channel is created by applying the specified
 * effectful function to the terminal value of this channel.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapEffect: <Env1, OutErr1, OutDone, OutDone1>(
  f: (o: OutDone) => Effect.Effect<Env1, OutErr1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1> = channel.mapEffect

/**
 * Returns a new channel, which is the same as this one, except the failure
 * value of the returned channel is created by applying the specified function
 * to the failure value of this channel.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapError: <OutErr, OutErr2>(
  f: (err: OutErr) => OutErr2
) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> = channel.mapError

/**
 * A more powerful version of `mapError` which also surfaces the `Cause`
 * of the channel failure.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapErrorCause: <OutErr, OutErr2>(
  f: (cause: Cause.Cause<OutErr>) => Cause.Cause<OutErr2>
) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> = channel.mapErrorCause

/**
 * Maps the output of this channel using the specified function.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapOut: <OutElem, OutElem2>(
  f: (o: OutElem) => OutElem2
) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> = channel.mapOut

/**
 * Creates a channel that is like this channel but the given effectful function
 * gets applied to each emitted output element.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapOutEffect: <OutElem, Env1, OutErr1, OutElem1>(
  f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone> = channel.mapOutEffect

/**
 * Creates a channel that is like this channel but the given ZIO function gets
 * applied to each emitted output element, taking `n` elements at once and
 * mapping them in parallel.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapOutEffectPar: (
  n: number
) => <OutElem, Env1, OutErr1, OutElem1>(
  f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone> = channel.mapOutEffectPar

/**
 * @since 1.0.0
 * @category utils
 */
export const mergeAll: (
  n: number,
  bufferSize?: number,
  mergeStrategy?: MergeStrategy.MergeStrategy
) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem>(
  channels: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, unknown>,
    unknown
  >
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem, unknown> =
  channel.mergeAll

/**
 * @since 1.0.0
 * @category utils
 */
export const mergeAllUnbounded: <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem>(
  channels: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, unknown>,
    unknown
  >
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem, unknown> =
  channel.mergeAllUnbounded

/**
 * @since 1.0.0
 * @category utils
 */
export const mergeAllUnboundedWith: <
  Env,
  Env1,
  InErr,
  InErr1,
  InElem,
  InElem1,
  InDone,
  InDone1,
  OutErr,
  OutErr1,
  OutElem,
  OutDone
>(
  channels: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, OutDone>,
    OutDone
  >,
  f: (o1: OutDone, o2: OutDone) => OutDone
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem, OutDone> =
  channel.mergeAllUnboundedWith

/**
 * @since 1.0.0
 * @category utils
 */
export const mergeAllWith: (
  n: number,
  bufferSize?: number,
  mergeStrategy?: MergeStrategy.MergeStrategy
) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem, OutDone>(
  channels: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, OutDone>,
    OutDone
  >,
  f: (o1: OutDone, o2: OutDone) => OutDone
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem, OutDone> =
  channel.mergeAllWith

/**
 * Returns a new channel which creates a new channel for each emitted element
 * and merges some of them together. Different merge strategies control what
 * happens if there are more than the given maximum number of channels gets
 * created. See `Channel.mergeAll`.
 *
 * @param n The maximum number of channels to merge.
 * @param bufferSize The number of elements that can be buffered from upstream for the merging.
 * @param mergeStrategy The `MergeStrategy` to use (either `BackPressure` or `Sliding`.
 * @param f The function that creates a new channel from each emitted element.
 * @since 1.0.0
 * @category mapping
 */
export const mergeMap: (
  n: number,
  bufferSize?: number,
  mergeStrategy?: MergeStrategy.MergeStrategy
) => <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
  f: (outElem: OutElem) => Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>
) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env1 | Env, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr1 | OutErr, OutElem1, unknown> =
  channel.mergeMap

/**
 * Returns a new channel which merges a number of channels emitted by this
 * channel using the back pressuring merge strategy. See `Channel.mergeAll`.
 *
 * @since 1.0.0
 * @category utils
 */
export const mergeOut: (
  n: number
) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone, Z>(
  self: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    OutDone
  >
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem1, unknown> =
  channel.mergeOut

/**
 * Returns a new channel which merges a number of channels emitted by this
 * channel using the back pressuring merge strategy and uses a given function
 * to merge each completed subchannel's result value. See
 * `Channel.mergeAll`.
 *
 * @since 1.0.0
 * @category utils
 */
export const mergeOutWith: <OutDone1>(
  n: number,
  f: (o1: OutDone1, o2: OutDone1) => OutDone1
) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1>(
  self: Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
    OutDone1
  >
) => Channel<Env | Env1, InErr & InErr1, InElem & InElem1, InDone & InDone1, OutErr | OutErr1, OutElem1, OutDone1> =
  channel.mergeOutWith

/**
 * Returns a new channel, which is the merge of this channel and the specified
 * channel, where the behavior of the returned channel on left or right early
 * termination is decided by the specified `leftDone` and `rightDone` merge
 * decisions.
 *
 * @since 1.0.0
 * @category utils
 */
export const mergeWith: <
  Env1,
  InErr1,
  InElem1,
  InDone1,
  OutErr,
  OutErr1,
  OutErr2,
  OutErr3,
  OutElem1,
  OutDone,
  OutDone1,
  OutDone2,
  OutDone3
>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
  leftDone: (
    exit: Exit.Exit<OutErr, OutDone>
  ) => MergeDecision.MergeDecision<Env1, OutErr1, OutDone1, OutErr2, OutDone2>,
  rightDone: (
    ex: Exit.Exit<OutErr1, OutDone1>
  ) => MergeDecision.MergeDecision<Env1, OutErr, OutDone, OutErr3, OutDone3>
) => <Env, InErr, InElem, InDone, OutElem>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr2 | OutErr3,
  OutElem1 | OutElem,
  OutDone2 | OutDone3
> = channel.mergeWith

/**
 * Returns a channel that never completes
 *
 * @since 1.0.0
 * @category constructors
 */
export const never: () => Channel<never, unknown, unknown, unknown, never, never, never> = channel.never

/**
 * Translates channel failure into death of the fiber, making all failures
 * unchecked and not a part of the type of the channel.
 *
 * @since 1.0.0
 * @category error handling
 */
export const orDie: <E>(
  error: LazyArg<E>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> = channel.orDie

/**
 * Keeps none of the errors, and terminates the fiber with them, using the
 * specified function to convert the `OutErr` into a defect.
 *
 * @since 1.0.0
 * @category error handling
 */
export const orDieWith: <OutErr>(
  f: (e: OutErr) => unknown
) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> = channel.orDieWith

/**
 * Returns a new channel that will perform the operations of this one, until
 * failure, and then it will switch over to the operations of the specified
 * fallback channel.
 *
 * @since 1.0.0
 * @category error handling
 */
export const orElse: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: LazyArg<Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1,
  OutElem1 | OutElem,
  OutDone1 | OutDone
> = channel.orElse

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel. The returned channel has the input type of this channel,
 * and the output type of the specified channel, terminating with the value of
 * the specified channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const pipeTo: <Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
  that: Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
) => <Env, InErr, InElem, InDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env2 | Env, InErr, InElem, InDone, OutErr | OutErr2, OutElem2, OutDone2> = core.pipeTo

/**
 * Returns a new channel that pipes the output of this channel into the
 * specified channel and preserves this channel's failures without providing
 * them to the other channel for observation.
 *
 * @since 1.0.0
 * @category utils
 */
export const pipeToOrFail: <Env2, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
  that: Channel<Env2, never, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
) => <Env, InErr, InElem, InDone, OutErr>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env2 | Env, InErr, InElem, InDone, OutErr | OutErr2, OutElem2, OutDone2> = channel.pipeToOrFail

/**
 * Provides the channel with its required environment, which eliminates its
 * dependency on `Env`.
 *
 * @since 1.0.0
 * @category environment
 */
export const provideEnvironment: <Env>(
  env: Context.Context<Env>
) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone> = core.provideEnvironment

/**
 * Provides a layer to the channel, which translates it to another level.
 *
 * @since 1.0.0
 * @category environment
 */
export const provideLayer: <R0, R, OutErr2>(
  layer: Layer.Layer<R0, OutErr2, R>
) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<R0, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone> = channel.provideLayer

/**
 * Transforms the environment being provided to the channel with the specified
 * function.
 *
 * @since 1.0.0
 * @category environment
 */
export const provideSomeEnvironment: <Env0, Env>(
  f: (env: Context.Context<Env0>) => Context.Context<Env>
) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env0, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.provideSomeEnvironment

/**
 * Splits the environment into two parts, providing one part using the
 * specified layer and leaving the remainder `Env0`.
 *
 * @since 1.0.0
 * @category environment
 */
export const provideSomeLayer: <Env0, Env2, OutErr2>(
  layer: Layer.Layer<Env0, OutErr2, Env2>
) => <R, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env0 | Exclude<R, Env2>, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone> =
  channel.provideSomeLayer

/**
 * Provides the effect with the single service it requires. If the effect
 * requires more than one service use `provideEnvironment` instead.
 *
 * @since 1.0.0
 * @category environment
 */
export const provideService: <T>(
  tag: Context.Tag<T>
) => <T1 extends T>(
  service: T1
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Exclude<Env, T>, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.provideService

/**
 * @since 1.0.0
 * @category constructors
 */
export const read: <In>() => Channel<never, unknown, In, unknown, Option.Option<never>, never, In> = channel.read

/**
 * @since 1.0.0
 * @category constructors
 */
export const readOrFail: <In, E>(error: E) => Channel<never, unknown, In, unknown, E, never, In> = core.readOrFail

/**
 * @since 1.0.0
 * @category constructors
 */
export const readWith: <
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  OutElem,
  OutDone,
  Env2,
  OutErr2,
  OutElem2,
  OutDone2,
  Env3,
  OutErr3,
  OutElem3,
  OutDone3
>(
  input: (input: InElem) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  error: (error: InErr) => Channel<Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  done: (done: InDone) => Channel<Env3, InErr, InElem, InDone, OutErr3, OutElem3, OutDone3>
) => Channel<
  Env | Env2 | Env3,
  InErr,
  InElem,
  InDone,
  OutErr | OutErr2 | OutErr3,
  OutElem | OutElem2 | OutElem3,
  OutDone | OutDone2 | OutDone3
> = core.readWith

/**
 * @since 1.0.0
 * @category constructors
 */
export const readWithCause: <
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  OutElem,
  OutDone,
  Env2,
  OutErr2,
  OutElem2,
  OutDone2,
  Env3,
  OutErr3,
  OutElem3,
  OutDone3
>(
  input: (input: InElem) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  halt: (cause: Cause.Cause<InErr>) => Channel<Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  done: (done: InDone) => Channel<Env3, InErr, InElem, InDone, OutErr3, OutElem3, OutDone3>
) => Channel<
  Env | Env2 | Env3,
  InErr,
  InElem,
  InDone,
  OutErr | OutErr2 | OutErr3,
  OutElem | OutElem2 | OutElem3,
  OutDone | OutDone2 | OutDone3
> = core.readWithCause

/**
 * Creates a channel which repeatedly runs this channel.
 *
 * @since 1.0.0
 * @category utils
 */
export const repeated: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.repeated

/**
 * Runs a channel until the end is received.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const run: <Env, InErr, InDone, OutErr, OutDone>(
  self: Channel<Env, InErr, unknown, InDone, OutErr, never, OutDone>
) => Effect.Effect<Env, OutErr, OutDone> = channel.run

/**
 * Run the channel until it finishes with a done value or fails with an error
 * and collects its emitted output elements.
 *
 * The channel must not read any input.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const runCollect: <Env, InErr, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
) => Effect.Effect<Env, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone]> = channel.runCollect

/**
 * Runs a channel until the end is received.
 *
 * @macro traced
 * @since 1.0.0
 * @category destructors
 */
export const runDrain: <Env, InErr, InDone, OutElem, OutErr, OutDone>(
  self: Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
) => Effect.Effect<Env, OutErr, OutDone> = channel.runDrain

/**
 * Use a scoped effect to emit an output element.
 *
 * @since 1.0.0
 * @category constructors
 */
export const scoped: <R, E, A>(
  effect: Effect.Effect<R | Scope.Scope, E, A>
) => Channel<Exclude<R, Scope.Scope>, unknown, unknown, unknown, E, A, unknown> = channel.scoped

/**
 * Accesses the specified service in the environment of the channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const service: <T>(tag: Context.Tag<T>) => Channel<T, unknown, unknown, unknown, never, never, T> =
  channel.service

/**
 * Accesses the specified service in the environment of the channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const serviceWith: <T>(
  tag: Context.Tag<T>
) => <OutDone>(f: (resource: T) => OutDone) => Channel<T, unknown, unknown, unknown, never, never, OutDone> =
  channel.serviceWith

/**
 * Accesses the specified service in the environment of the channel in the
 * context of a channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const serviceWithChannel: <T>(
  tag: Context.Tag<T>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  f: (resource: T) => Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<T | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> = channel.serviceWithChannel

/**
 * Accesses the specified service in the environment of the channel in the
 * context of an effect.
 *
 * @since 1.0.0
 * @category environment
 */
export const serviceWithEffect: <T>(
  tag: Context.Tag<T>
) => <Env, OutErr, OutDone>(
  f: (resource: T) => Effect.Effect<Env, OutErr, OutDone>
) => Channel<T | Env, unknown, unknown, unknown, OutErr, never, OutDone> = channel.serviceWithEffect

/**
 * Constructs a channel that succeeds immediately with the specified value.
 *
 * @since 1.0.0
 * @category constructors
 */
export const succeed: <A>(value: A) => Channel<never, unknown, unknown, unknown, never, never, A> = core.succeed

/**
 * Constructs a channel that succeeds immediately with the specified lazy value.
 *
 * @since 1.0.0
 * @category constructors
 */
export const sync: <OutDone>(
  evaluate: LazyArg<OutDone>
) => Channel<never, unknown, unknown, unknown, never, never, OutDone> = core.sync

/**
 * Converts a `Channel` to a `Hub`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toHub: <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
) => Channel<never, Err, Elem, Done, never, never, unknown> = channel.toHub

/**
 * Returns a scoped `Effect` that can be used to repeatedly pull elements from
 * the constructed `Channel`. The pull effect fails with the channel's failure
 * in case the channel fails, or returns either the channel's done value or an
 * emitted element.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toPull: <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Effect.Effect<Scope.Scope | Env, never, Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>>> =
  channel.toPull

/**
 * Converts a `Channel` to a `Queue`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toQueue: <Err, Done, Elem>(
  queue: Queue.Enqueue<Either.Either<Exit.Exit<Err, Done>, Elem>>
) => Channel<never, Err, Elem, Done, never, never, unknown> = channel.toQueue

/** Converts this channel to a `Sink`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toSink: <Env, InErr, InElem, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, Chunk.Chunk<InElem>, unknown, OutErr, Chunk.Chunk<OutElem>, OutDone>
) => Sink.Sink<Env, OutErr, InElem, OutElem, OutDone> = sink.channelToSink

/**
 * Converts this channel to a `Stream`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toStream: <Env, OutErr, OutElem, OutDone>(
  self: Channel<Env, unknown, unknown, unknown, OutErr, Chunk.Chunk<OutElem>, OutDone>
) => Stream.Stream<Env, OutErr, OutElem> = stream.channelToStream

/**
 * @since 1.0.0
 * @category constructors
 */
export const unit: () => Channel<never, unknown, unknown, unknown, never, never, void> = core.unit

/**
 * Makes a channel from an effect that returns a channel in case of success.
 *
 * @since 1.0.0
 * @category constructors
 */
export const unwrap: <R, E, R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  channel: Effect.Effect<R, E, Channel<R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
) => Channel<R | R2, InErr, InElem, InDone, E | OutErr, OutElem, OutDone> = channel.unwrap

/**
 * Makes a channel from a managed that returns a channel in case of success.
 *
 * @since 1.0.0
 * @category constructors
 */
export const unwrapScoped: <R, E, Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Effect.Effect<Scope.Scope | R, E, Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
) => Channel<Env | Exclude<R, Scope.Scope>, InErr, InElem, InDone, E | OutErr, OutElem, OutDone> = channel.unwrapScoped

/**
 * Updates a service in the environment of this channel.
 *
 * @since 1.0.0
 * @category environment
 */
export const updateService: <T>(
  tag: Context.Tag<T>
) => <T1 extends T>(
  f: (resource: T) => T1
) => <R, InErr, InDone, OutElem, OutErr, OutDone>(
  self: Channel<R, InErr, unknown, InDone, OutErr, OutElem, OutDone>
) => Channel<T | R, InErr, unknown, InDone, OutErr, OutElem, OutDone> = channel.updateService

/**
 * Writes a single value to the channel.
 *
 * @since 1.0.0
 * @category constructors
 */
export const write: <OutElem>(out: OutElem) => Channel<never, unknown, unknown, unknown, never, OutElem, void> =
  core.write

/**
 * Writes a sequence of values to the channel.
 *
 * @since 1.0.0
 * @category constructors
 */
export const writeAll: <OutElems extends Array<any>>(
  ...outs: OutElems
) => Channel<never, unknown, unknown, unknown, never, OutElems[number], void> = channel.writeAll

/**
 * Writes a `Chunk` of values to the channel.
 *
 * @since 1.0.0
 * @category constructors
 */
export const writeChunk: <OutElem>(
  outs: Chunk.Chunk<OutElem>
) => Channel<never, unknown, unknown, unknown, never, OutElem, void> = channel.writeChunk

/**
 * Returns a new channel that is the sequential composition of this channel
 * and the specified channel. The returned channel terminates with a tuple of
 * the terminal values of both channels.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zip: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  readonly [OutDone, OutDone1]
> = channel.zip

/**
 * Returns a new channel that is the sequential composition of this channel
 * and the specified channel. The returned channel terminates with the
 * terminal value of this channel.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zipLeft: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  OutDone
> = channel.zipLeft

/**
 * Returns a new channel that is the sequential composition of this channel
 * and the specified channel. The returned channel terminates with the
 * terminal value of that channel.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zipRight: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  OutDone1
> = channel.zipRight

/**
 * Creates a new channel which runs in parallel this and the other channel and
 * when both succeeds finishes with a tuple of both channel's done value.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zipPar: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  readonly [OutDone, OutDone1]
> = channel.zipPar

/**
 * Creates a new channel which runs in parallel this and the other channel and
 * when both succeeds finishes with the first one's done value.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zipParLeft: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  OutDone
> = channel.zipParLeft

/**
 * Creates a new channel which runs in parallel this and the other channel and
 * when both succeeds finishes with the second one's done value.
 *
 * @since 1.0.0
 * @category zipping
 */
export const zipParRight: <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
) => Channel<
  Env1 | Env,
  InErr & InErr1,
  InElem & InElem1,
  InDone & InDone1,
  OutErr1 | OutErr,
  OutElem1 | OutElem,
  OutDone1
> = channel.zipParRight

/**
 * Represents a generic checked exception which occurs when a `Channel` is
 * executed.
 *
 * @since 1.0.0
 * @category errors
 */
export const ChannelException: <E>(error: E) => ChannelException<E> = channel.ChannelException

/**
 * Returns `true` if the specified value is an `ChannelException`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isChannelException: (u: unknown) => u is ChannelException<unknown> = channel.isChannelException
