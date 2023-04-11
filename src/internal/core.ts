import * as Chunk from "@effect/data/Chunk"
import type * as Context from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import * as Either from "@effect/data/Either"
import { constVoid, identity } from "@effect/data/Function"
import type { LazyArg } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Cause from "@effect/io/Cause"
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
  [ChannelTypeId]: channelVariance,
  traced(trace: Debug.Trace) {
    if (trace) {
      return Object.create(proto, {
        _tag: { value: OpCodes.OP_TRACED },
        channel: { value: this },
        trace: { value: trace }
      })
    }
    return this
  }
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
  | Traced

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
export interface Traced extends
  Op<OpCodes.OP_TRACED, {
    readonly channel: ErasedChannel
    readonly trace: NonNullable<Debug.Trace>
  }>
{}

/** @internal */
export const acquireReleaseOut = Debug.dualWithTrace<
  <R2, Z>(
    release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, unknown>
  ) => <R, E>(self: Effect.Effect<R, E, Z>) => Channel.Channel<R | R2, unknown, unknown, unknown, E, Z, void>,
  <R, R2, E, Z>(
    self: Effect.Effect<R, E, Z>,
    release: (z: Z, e: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, unknown>
  ) => Channel.Channel<R | R2, unknown, unknown, unknown, E, Z, void>
>(2, (trace, restore) =>
  (self, release) => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_BRACKET_OUT
    op.acquire = () => self
    op.finalizer = restore(release)
    return op.traced(trace)
  })

/** @internal */
export const catchAllCause = Debug.dualWithTrace<
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
  >,
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
  >
>(
  2,
  (trace, restore) =>
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
    > => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_FOLD
      op.channel = self
      op.k = new ContinuationKImpl(succeed, restore(f))
      return op.traced(trace)
    }
)

/** @internal */
export const collectElements = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
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
      return flatMap(
        pipeTo(self, collectElementsReader(builder)),
        (value) => sync(() => [Chunk.fromIterable(builder), value] as const)
      )
    }).traced(trace)
  }
)

/** @internal */
const collectElementsReader = <OutErr, OutElem, OutDone>(
  builder: Array<OutElem>
): Channel.Channel<never, OutErr, OutElem, OutDone, OutErr, never, OutDone> => {
  return readWith(
    (outElem) =>
      flatMap(
        sync(() => {
          builder.push(outElem)
        }),
        () => collectElementsReader<OutErr, OutElem, OutDone>(builder)
      ),
    fail,
    succeedNow
  )
}

/** @internal */
export const concatAll = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem>(
    channels: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any>,
      any
    >
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, any> =>
    concatAllWith(channels, constVoid, constVoid).traced(trace)
)

/** @internal */
export const concatAllWith = Debug.methodWithTrace((trace, restore) =>
  <
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
  > => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_CONCAT_ALL
    op.combineInners = restore(f)
    op.combineAll = restore(g)
    op.onPull = () => upstreamPullStrategy.PullAfterNext(Option.none())
    op.onEmit = () => childExecutorDecision.Continue
    op.value = () => channels
    op.k = identity
    return op.traced(trace)
  }
)

/** @internal */
export const concatMapWith = Debug.dualWithTrace<
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
  >,
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
  >
>(
  4,
  (trace, restore) =>
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
    > => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_CONCAT_ALL
      op.combineInners = restore(g)
      op.combineAll = restore(h)
      op.onPull = () => upstreamPullStrategy.PullAfterNext(Option.none())
      op.onEmit = () => childExecutorDecision.Continue
      op.value = () => self
      op.k = restore(f)
      return op.traced(trace)
    }
)

/** @internal */
export const concatMapWithCustom = Debug.dualWithTrace<
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
  >,
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
  >
>(
  6,
  (trace, restore) =>
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
    > => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_CONCAT_ALL
      op.combineInners = restore(g)
      op.combineAll = restore(h)
      op.onPull = restore(onPull)
      op.onEmit = restore(onEmit)
      op.value = () => self
      op.k = restore(f)
      return op.traced(trace)
    }
)

/** @internal */
export const embedInput = Debug.dualWithTrace<
  <InErr, InElem, InDone>(
    input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
  ) => <Env, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, OutErr, OutElem, OutDone, InErr, InElem, InDone>(
    self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>,
    input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  (trace) =>
    <Env, OutErr, OutElem, OutDone, InErr, InElem, InDone>(
      self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, OutElem, OutDone>,
      input: SingleProducerAsyncInput.AsyncInputProducer<InErr, InElem, InDone>
    ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_BRIDGE
      op.input = input
      op.channel = self
      return op.traced(trace)
    }
)

/** @internal */
export const ensuringWith = Debug.dualWithTrace<
  <Env2, OutErr, OutDone>(
    finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
  ) => <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutElem, Env2, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutElem, Env2, OutErr, OutDone>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      finalizer: (e: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env2, never, unknown>
    ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_ENSURING
      op.channel = self
      op.finalizer = restore(finalizer)
      return op.traced(trace)
    }
)

/** @internal */
export const fail = Debug.methodWithTrace((trace) =>
  <E>(error: E): Channel.Channel<never, unknown, unknown, unknown, E, never, never> =>
    failCause(Cause.fail(error)).traced(trace)
)

/** @internal */
export const failSync = Debug.methodWithTrace((trace, restore) =>
  <E>(
    evaluate: LazyArg<E>
  ): Channel.Channel<never, unknown, unknown, unknown, E, never, never> =>
    failCauseSync(() => Cause.fail(restore(evaluate)())).traced(trace)
)

/** @internal */
export const failCause = Debug.methodWithTrace((trace) =>
  <E>(
    cause: Cause.Cause<E>
  ): Channel.Channel<never, unknown, unknown, unknown, E, never, never> => failCauseSync(() => cause).traced(trace)
)

/** @internal */
export const failCauseSync = Debug.methodWithTrace((trace, restore) =>
  <E>(
    evaluate: LazyArg<Cause.Cause<E>>
  ): Channel.Channel<never, unknown, unknown, unknown, E, never, never> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_FAIL
    op.error = restore(evaluate)
    return op.traced(trace)
  }
)

/** @internal */
export const flatMap = Debug.dualWithTrace<
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
  >,
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
  >
>(
  2,
  (trace, restore) =>
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
    > => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_FOLD
      op.channel = self
      op.k = new ContinuationKImpl(restore(f), failCause)
      return op.traced(trace)
    }
)

/** @internal */
export const foldCauseChannel = Debug.dualWithTrace<
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
  >,
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
  >
>(
  3,
  (trace, restore) =>
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
    > => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_FOLD
      op.channel = self
      op.k = new ContinuationKImpl(restore(onSuccess), restore(onError) as any)
      return op.traced(trace)
    }
)

/** @internal */
export const fromEffect = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    effect: Effect.Effect<R, E, A>
  ): Channel.Channel<R, unknown, unknown, unknown, E, never, A> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_FROM_EFFECT
    op.effect = () => effect
    return op.traced(trace)
  }
)

/** @internal */
export const pipeTo = Debug.dualWithTrace<
  <Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => <Env, InErr, InElem, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>,
  <Env, InErr, InElem, InDone, Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2>
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env2, OutErr, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
    ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr2, OutElem2, OutDone2> => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_PIPE_TO
      op.left = () => self
      op.right = () => that
      return op.traced(trace)
    }
)

/** @internal */
export const provideContext = Debug.dualWithTrace<
  <Env>(
    env: Context.Context<Env>
  ) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    env: Context.Context<Env>
  ) => Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  (trace) =>
    <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      env: Context.Context<Env>
    ): Channel.Channel<never, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
      const op = Object.create(proto)
      op._tag = OpCodes.OP_PROVIDE
      op.context = () => env
      op.inner = self
      return op.traced(trace)
    }
)

/** @internal */
export const readOrFail = Debug.methodWithTrace((trace) =>
  <In, E>(
    error: E
  ): Channel.Channel<never, unknown, In, unknown, E, never, In> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_READ
    op.more = succeed
    op.done = new ContinuationKImpl(() => fail(error), () => fail(error))
    return op.traced(trace)
  }
)

/** @internal */
export const readWith = Debug.methodWithTrace((trace, restore) =>
  <
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
  > =>
    readWithCause(
      restore(input),
      (cause) => Either.match(Cause.failureOrCause(cause), restore(error), failCause),
      restore(done)
    )
)

/** @internal */
export const readWithCause = Debug.methodWithTrace((trace, restore) =>
  <
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
  > => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_READ
    op.more = restore(input)
    op.done = new ContinuationKImpl(restore(done), restore(halt) as any)
    return op.traced(trace)
  }
)

/** @internal */
export const succeed = Debug.methodWithTrace((trace) =>
  <A>(
    value: A
  ): Channel.Channel<never, unknown, unknown, unknown, never, never, A> => sync(() => value).traced(trace)
)

/** @internal */
export const succeedNow = Debug.methodWithTrace((trace) =>
  <OutDone>(
    result: OutDone
  ): Channel.Channel<never, unknown, unknown, unknown, never, never, OutDone> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_SUCCEED_NOW
    op.terminal = result
    return op.traced(trace)
  }
)

/** @internal */
export const suspend = Debug.methodWithTrace((trace, restore) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    evaluate: LazyArg<Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_SUSPEND
    op.channel = restore(evaluate)
    return op.traced(trace)
  }
)

export const sync = Debug.methodWithTrace((trace, restore) =>
  <OutDone>(
    evaluate: LazyArg<OutDone>
  ): Channel.Channel<never, unknown, unknown, unknown, never, never, OutDone> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_SUCCEED
    op.evaluate = restore(evaluate)
    return op.traced(trace)
  }
)

/** @internal */
export const unit = Debug.methodWithTrace((trace) =>
  (): Channel.Channel<never, unknown, unknown, unknown, never, never, void> => succeedNow(void 0).traced(trace)
)

/** @internal */
export const write = Debug.methodWithTrace((trace) =>
  <OutElem>(
    out: OutElem
  ): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> => {
    const op = Object.create(proto)
    op._tag = OpCodes.OP_EMIT
    op.out = out
    return op.traced(trace)
  }
)
