import * as Cause from "@effect/io/Cause"
import * as Debug from "@effect/io/Debug"
import type * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import type * as Channel from "@effect/stream/Channel"
import type * as ChildExecutorDecision from "@effect/stream/Channel/ChildExecutorDecision"
import type * as SingleProducerAsyncInput from "@effect/stream/Channel/SingleProducerAsyncInput"
import type * as UpstreamPullRequest from "@effect/stream/Channel/UpstreamPullRequest"
import type * as UpstreamPullStrategy from "@effect/stream/Channel/UpstreamPullStrategy"
import * as childExecutorDecision from "@effect/stream/internal/channel/childExecutorDecision"
import type { ErasedContinuationK } from "@effect/stream/internal/channel/continuation"
import { ContinuationKImpl } from "@effect/stream/internal/channel/continuation"
import * as upstreamPullStrategy from "@effect/stream/internal/channel/upstreamPullStrategy"
import * as OpCodes from "@effect/stream/internal/opCodes/channel"
import * as Either from "@fp-ts/core/Either"
import type { LazyArg } from "@fp-ts/core/Function"
import { constVoid, identity, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import * as Chunk from "@fp-ts/data/Chunk"
import type * as Context from "@fp-ts/data/Context"

/** @internal */
const ChannelSymbolKey = "@effect/stream/Channel"

/** @internal */
export const ChannelTypeId: Channel.ChannelTypeId = Symbol.for(
  ChannelSymbolKey
) as Channel.ChannelTypeId

/** @internal */
const channelVariance = {
  _Env: (_: never) => _,
  _InErr: (_: unknown) => _,
  _InElem: (_: unknown) => _,
  _InDone: (_: unknown) => _,
  _OutErr: (_: never) => _,
  _OutElem: (_: never) => _,
  _OutDone: (_: never) => _
}

/** @internal */
const proto = {
  [ChannelTypeId]: channelVariance
}

/** @internal */
type ErasedChannel = Channel.Channel<never, unknown, unknown, unknown, never, never, never>

/** @internal */
export type Op<Tag extends string, Body = {}> =
  & ErasedChannel
  & Body
  & { readonly _tag: Tag }

export type Primitive =
  | BracketOut
  | Bridge
  | ConcatAll
  | Emit
  | Ensuring
  | Fail
  | Fold
  | FromEffect
  | PipeTo
  | Provide
  | Read
  | Succeed
  | SucceedNow
  | Suspend

/** @internal */
export interface BracketOut extends
  Op<OpCodes.OP_BRACKET_OUT, {
    readonly acquire: LazyArg<Effect.Effect<unknown, unknown, unknown>>
    readonly finalizer: (
      resource: unknown,
      exit: Exit.Exit<unknown, unknown>
    ) => Effect.Effect<unknown, unknown, unknown>
  }>
{}

/** @internal */
export interface Bridge extends
  Op<OpCodes.OP_BRIDGE, {
    readonly input: SingleProducerAsyncInput.AsyncInputProducer<unknown, unknown, unknown>
    readonly channel: ErasedChannel
  }>
{}

/** @internal */
export interface ConcatAll extends
  Op<OpCodes.OP_CONCAT_ALL, {
    readonly combineInners: (outDone: unknown, outDone2: unknown) => unknown
    readonly combineAll: (outDone: unknown, outDone2: unknown) => unknown
    readonly onPull: (
      request: UpstreamPullRequest.UpstreamPullRequest<unknown>
    ) => UpstreamPullStrategy.UpstreamPullStrategy<unknown>
    readonly onEmit: (outElem: unknown) => ChildExecutorDecision.ChildExecutorDecision
    readonly value: LazyArg<ErasedChannel>
    readonly k: (outElem: unknown) => ErasedChannel
  }>
{}

/** @internal */
export interface Emit extends
  Op<OpCodes.OP_EMIT, {
    readonly out: unknown
  }>
{}

/** @internal */
export interface Ensuring extends
  Op<OpCodes.OP_ENSURING, {
    readonly channel: ErasedChannel
    readonly finalizer: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>
  }>
{}

/** @internal */
export interface Fail extends
  Op<OpCodes.OP_FAIL, {
    readonly error: LazyArg<Cause.Cause<unknown>>
  }>
{}

/** @internal */
export interface Fold extends
  Op<OpCodes.OP_FOLD, {
    readonly channel: ErasedChannel
    readonly k: ErasedContinuationK
  }>
{}

/** @internal */
export interface FromEffect extends
  Op<OpCodes.OP_FROM_EFFECT, {
    readonly effect: LazyArg<Effect.Effect<unknown, unknown, unknown>>
  }>
{}

/** @internal */
export interface PipeTo extends
  Op<OpCodes.OP_PIPE_TO, {
    readonly left: LazyArg<ErasedChannel>
    readonly right: LazyArg<ErasedChannel>
  }>
{}

/** @internal */
export interface Provide extends
  Op<OpCodes.OP_PROVIDE, {
    readonly context: LazyArg<Context.Context<unknown>>
    readonly inner: ErasedChannel
  }>
{}

/** @internal */
export interface Read extends
  Op<OpCodes.OP_READ, {
    readonly more: (input: unknown) => ErasedChannel
    readonly done: ErasedContinuationK
  }>
{}

/** @internal */
export interface Succeed extends
  Op<OpCodes.OP_SUCCEED, {
    readonly evaluate: LazyArg<unknown>
  }>
{}

/** @internal */
export interface SucceedNow extends
  Op<OpCodes.OP_SUCCEED_NOW, {
    readonly terminal: unknown
  }>
{}

/** @internal */
export interface Suspend extends
  Op<OpCodes.OP_SUSPEND, {
    readonly channel: LazyArg<ErasedChannel>
  }>
{}

/** @internal */
export const acquireReleaseOut = <R, R2, E, Z>(
  self: Effect.Effect<R, E, Z>,
  release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, unknown>
): Channel.Channel<R | R2, unknown, unknown, unknown, E, Z, void> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_BRACKET_OUT },
    acquire: { value: () => self },
    finalizer: { value: release }
  })

/** @internal */
export const catchAllCause = Debug.dual<
  <Env, InErr, InElem, InDone, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (cause: Cause.Cause<OutErr>) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1,
    OutElem1 | OutElem,
    OutDone1 | OutDone
  >,
  <Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
    f: (cause: Cause.Cause<OutErr>) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1,
    OutElem1 | OutElem,
    OutDone1 | OutDone
  >
>(
  2,
  <Env, InErr, InElem, InDone, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (cause: Cause.Cause<OutErr>) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1,
    OutElem | OutElem1,
    OutDone | OutDone1
  > =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_FOLD },
      channel: { value: self },
      k: { value: new ContinuationKImpl(succeed, f) }
    })
)

/** @internal */
export const collectElements = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Channel.Channel<
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  never,
  readonly [Chunk.Chunk<OutElem>, OutDone]
> => {
  return suspend(() => {
    const builder: Array<OutElem> = []
    return pipe(
      self,
      pipeTo(collectElementsReader(builder)),
      flatMap((value) => sync(() => [Chunk.fromIterable(builder), value]))
    )
  })
}

/** @internal */
const collectElementsReader = <OutErr, OutElem, OutDone>(
  builder: Array<OutElem>
): Channel.Channel<never, OutErr, OutElem, OutDone, OutErr, never, OutDone> => {
  return readWith(
    (outElem) =>
      pipe(
        sync(() => {
          builder.push(outElem)
        }),
        flatMap(() => collectElementsReader<OutErr, OutElem, OutDone>(builder))
      ),
    fail,
    succeedNow
  )
}

/** @internal */
export const concatAll = <Env, InErr, InElem, InDone, OutErr, OutElem>(
  channels: Channel.Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any>,
    any
  >
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any> => {
  return concatAllWith(channels, constVoid, constVoid)
}

/** @internal */
export const concatAllWith = <
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
  channels: Channel.Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem, OutDone>,
    OutDone2
  >,
  f: (o: OutDone, o1: OutDone) => OutDone,
  g: (o: OutDone, o2: OutDone2) => OutDone3
): Channel.Channel<
  Env | Env2,
  InErr & InErr2,
  InElem & InElem2,
  InDone & InDone2,
  OutErr | OutErr2,
  OutElem,
  OutDone3
> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_CONCAT_ALL },
    combineInners: { value: f },
    combineAll: { value: g },
    onPull: { value: () => upstreamPullStrategy.PullAfterNext(Option.none()) },
    onEmit: { value: () => childExecutorDecision.Continue },
    value: { value: () => channels },
    k: { value: identity }
  })

/** @internal */
export const concatMapWith = Debug.dual<
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    OutDone3
  >,
  <OutElem, OutElem2, OutDone, OutDone2, OutDone3, Env2, InErr2, InElem2, InDone2, OutErr2>(
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3
  ) => <Env, InErr, InElem, InDone, OutErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    OutDone3
  >
>(
  4,
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
    f: (
      o: OutElem
    ) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3
  ): Channel.Channel<
    Env | Env2,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr | OutErr2,
    OutElem2,
    OutDone3
  > =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_CONCAT_ALL },
      combineInners: { value: g },
      combineAll: { value: h },
      onPull: { value: () => upstreamPullStrategy.PullAfterNext(Option.none()) },
      onEmit: { value: () => childExecutorDecision.Continue },
      value: { value: () => self },
      k: { value: f }
    })
)

/** @internal */
export const concatMapWithCustom = Debug.dual<
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3,
    onPull: (
      upstreamPullRequest: UpstreamPullRequest.UpstreamPullRequest<OutElem>
    ) => UpstreamPullStrategy.UpstreamPullStrategy<OutElem2>,
    onEmit: (elem: OutElem2) => ChildExecutorDecision.ChildExecutorDecision
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    OutDone3
  >,
  <OutElem, OutElem2, OutDone, OutDone2, OutDone3, Env2, InErr2, InElem2, InDone2, OutErr2>(
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3,
    onPull: (
      upstreamPullRequest: UpstreamPullRequest.UpstreamPullRequest<OutElem>
    ) => UpstreamPullStrategy.UpstreamPullStrategy<OutElem2>,
    onEmit: (elem: OutElem2) => ChildExecutorDecision.ChildExecutorDecision
  ) => <Env, InErr, InElem, InDone, OutErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    OutDone3
  >
>(
  6,
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
    f: (
      o: OutElem
    ) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone>,
    g: (o: OutDone, o1: OutDone) => OutDone,
    h: (o: OutDone, o2: OutDone2) => OutDone3,
    onPull: (
      upstreamPullRequest: UpstreamPullRequest.UpstreamPullRequest<OutElem>
    ) => UpstreamPullStrategy.UpstreamPullStrategy<OutElem2>,
    onEmit: (elem: OutElem2) => ChildExecutorDecision.ChildExecutorDecision
  ): Channel.Channel<
    Env | Env2,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr | OutErr2,
    OutElem2,
    OutDone3
  > =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_CONCAT_ALL },
      combineInners: { value: g },
      combineAll: { value: h },
      onPull: { value: onPull },
      onEmit: { value: onEmit },
      value: { value: () => self },
      k: { value: f }
    })
)

/** @internal */
export const embedInput = Debug.dual<
  <Env, OutErr, OutElem, OutDone, InErr, InElem, InDone>(
    self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>,
    input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <InErr, InElem, InDone>(
    input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
  ) => <Env, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  <Env, OutErr, OutElem, OutDone, InErr, InElem, InDone>(
    self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>,
    input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_BRIDGE },
      input: { value: input },
      channel: { value: self }
    })
)

/** @internal */
export const ensuringWith = Debug.dual<
  <Env, InErr, InElem, InDone, OutElem, Env2, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env2, OutErr, OutDone>(
    finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
  ) => <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  <Env, InErr, InElem, InDone, OutElem, Env2, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
  ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_ENSURING },
      channel: { value: self },
      finalizer: { value: finalizer }
    })
)

/** @internal */
export const fail = <E>(error: E): Channel.Channel<never, unknown, unknown, unknown, E, never, never> => {
  return failCause(Cause.fail(error))
}

/** @internal */
export const failSync = <E>(
  evaluate: LazyArg<E>
): Channel.Channel<never, unknown, unknown, unknown, E, never, never> => {
  return failCauseSync(() => Cause.fail(evaluate()))
}

/** @internal */
export const failCause = <E>(
  cause: Cause.Cause<E>
): Channel.Channel<never, unknown, unknown, unknown, E, never, never> => {
  return failCauseSync(() => cause)
}

/** @internal */
export const failCauseSync = <E>(
  evaluate: LazyArg<Cause.Cause<E>>
): Channel.Channel<never, unknown, unknown, unknown, E, never, never> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_FAIL },
    error: { value: evaluate }
  })

/** @internal */
export const flatMap = Debug.dual<
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (d: OutDone) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone2
  >,
  <OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>(
    f: (d: OutDone) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone2
  >
>(
  2,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (d: OutDone) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone2
  > =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_FOLD },
      channel: { value: self },
      k: { value: new ContinuationKImpl(f, failCause) }
    })
)

/** @internal */
export const foldCauseChannel = Debug.dual<
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutElem,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    onError: (c: Cause.Cause<OutErr>) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr2, OutElem1, OutDone2>,
    onSuccess: (o: OutDone) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr3, OutElem2, OutDone3>
  ) => Channel.Channel<
    Env1 | Env2 | Env,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr2 | OutErr3,
    OutElem1 | OutElem2 | OutElem,
    OutDone2 | OutDone3
  >,
  <
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
    onError: (c: Cause.Cause<OutErr>) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr2, OutElem1, OutDone2>,
    onSuccess: (o: OutDone) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr3, OutElem2, OutDone3>
  ) => <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env2 | Env,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr2 | OutErr3,
    OutElem1 | OutElem2 | OutElem,
    OutDone2 | OutDone3
  >
>(
  3,
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutElem,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    onError: (
      c: Cause.Cause<OutErr>
    ) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr2, OutElem1, OutDone2>,
    onSuccess: (
      o: OutDone
    ) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr3, OutElem2, OutDone3>
  ): Channel.Channel<
    Env | Env1 | Env2,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr2 | OutErr3,
    OutElem | OutElem1 | OutElem2,
    OutDone2 | OutDone3
  > =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_FOLD },
      channel: { value: self },
      k: { value: new ContinuationKImpl(onSuccess, onError as any) }
    })
)

/** @internal */
export const fromEffect = <R, E, A>(
  effect: Effect.Effect<R, E, A>
): Channel.Channel<R, unknown, unknown, unknown, E, never, A> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_FROM_EFFECT },
    effect: { value: () => effect }
  })

/** @internal */
export const pipeTo = Debug.dual<
  <Env, InErr, InElem, InDone, Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  <Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => <Env, InErr, InElem, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>
>(
  2,
  <Env, InErr, InElem, InDone, Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2> =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_PIPE_TO },
      left: { value: () => self },
      right: { value: () => that }
    })
)

/** @internal */
export const provideContext = Debug.dual<
  <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    env: Context.Context<Env>
  ) => Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env>(
    env: Context.Context<Env>
  ) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    env: Context.Context<Env>
  ): Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    Object.create(proto, {
      _tag: { value: OpCodes.OP_PROVIDE },
      context: { value: () => env },
      inner: { value: self }
    })
)

/** @internal */
export const readOrFail = <In, E>(
  error: E
): Channel.Channel<never, unknown, In, unknown, E, never, In> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_READ },
    more: { value: succeed },
    done: { value: new ContinuationKImpl(() => fail(error), () => fail(error)) }
  })

/** @internal */
export const readWith = <
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
  input: (input: InElem) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  error: (error: InErr) => Channel.Channel<Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  done: (done: InDone) => Channel.Channel<Env3, InErr, InElem, InDone, OutErr3, OutElem3, OutDone3>
): Channel.Channel<
  Env | Env2 | Env3,
  InErr,
  InElem,
  InDone,
  OutErr | OutErr2 | OutErr3,
  OutElem | OutElem2 | OutElem3,
  OutDone | OutDone2 | OutDone3
> => {
  return readWithCause(input, (cause) => pipe(Cause.failureOrCause(cause), Either.match(error, failCause)), done)
}

/** @internal */
export const readWithCause = <
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
  input: (input: InElem) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  halt: (cause: Cause.Cause<InErr>) => Channel.Channel<Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  done: (done: InDone) => Channel.Channel<Env3, InErr, InElem, InDone, OutErr3, OutElem3, OutDone3>
): Channel.Channel<
  Env | Env2 | Env3,
  InErr,
  InElem,
  InDone,
  OutErr | OutErr2 | OutErr3,
  OutElem | OutElem2 | OutElem3,
  OutDone | OutDone2 | OutDone3
> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_READ },
    more: { value: input },
    done: { value: new ContinuationKImpl(done, halt as any) }
  })

/** @internal */
export const succeed = <A>(
  value: A
): Channel.Channel<never, unknown, unknown, unknown, never, never, A> => {
  return sync(() => value)
}

/** @internal */
export const succeedNow = <OutDone>(
  result: OutDone
): Channel.Channel<never, unknown, unknown, unknown, never, never, OutDone> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_SUCCEED_NOW },
    terminal: { value: result }
  })

/** @internal */
export const suspend = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  evaluate: LazyArg<Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_SUSPEND },
    channel: { value: evaluate }
  })

export const sync = <OutDone>(
  evaluate: LazyArg<OutDone>
): Channel.Channel<never, unknown, unknown, unknown, never, never, OutDone> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_SUCCEED },
    evaluate: { value: evaluate }
  })

/** @internal */
export const unit = (): Channel.Channel<never, unknown, unknown, unknown, never, never, void> => succeedNow(undefined)

/** @internal */
export const write = <OutElem>(out: OutElem): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_EMIT },
    out: { value: out }
  })
