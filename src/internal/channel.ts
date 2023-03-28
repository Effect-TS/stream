import * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import * as Either from "@effect/data/Either"
import * as Equal from "@effect/data/Equal"
import { constVoid, identity, pipe } from "@effect/data/Function"
import type { LazyArg } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import type { Predicate } from "@effect/data/Predicate"
import * as Cause from "@effect/io/Cause"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as Hub from "@effect/io/Hub"
import * as Layer from "@effect/io/Layer"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Scope from "@effect/io/Scope"
import type * as Channel from "@effect/stream/Channel"
import type * as MergeDecision from "@effect/stream/Channel/MergeDecision"
import type * as MergeState from "@effect/stream/Channel/MergeState"
import type * as MergeStrategy from "@effect/stream/Channel/MergeStrategy"
import type * as SingleProducerAsyncInput from "@effect/stream/Channel/SingleProducerAsyncInput"
import * as executor from "@effect/stream/internal/channel/channelExecutor"
import type * as ChannelState from "@effect/stream/internal/channel/channelState"
import * as mergeDecision from "@effect/stream/internal/channel/mergeDecision"
import * as mergeState from "@effect/stream/internal/channel/mergeState"
import * as _mergeStrategy from "@effect/stream/internal/channel/mergeStrategy"
import * as singleProducerAsyncInput from "@effect/stream/internal/channel/singleProducerAsyncInput"
import * as core from "@effect/stream/internal/core"
import * as ChannelStateOpCodes from "@effect/stream/internal/opCodes/channelState"
import * as MergeDecisionOpCodes from "@effect/stream/internal/opCodes/mergeDecision"
import * as MergeStateOpCodes from "@effect/stream/internal/opCodes/mergeState"

/** @internal */
export const acquireUseRelease = Debug.methodWithTrace((trace, restore) =>
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    OutElem1,
    OutDone,
    Acquired
  >(
    acquire: Effect.Effect<Env, OutErr, Acquired>,
    use: (a: Acquired) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone>,
    release: (a: Acquired, exit: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env, never, any>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone> =>
    core.flatMap(
      core.fromEffect(
        Ref.make<
          (exit: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env, never, any>
        >(() => Effect.unit())
      ),
      (ref) =>
        pipe(
          core.fromEffect(
            Effect.uninterruptible(
              Effect.tap(
                acquire,
                (a) => Ref.set(ref, (exit) => restore(release)(a, exit))
              )
            )
          ),
          core.flatMap(restore(use)),
          core.ensuringWith((exit) => Effect.flatMap(Ref.get(ref), (f) => f(exit)))
        )
    ).traced(trace)
)

/** @internal */
export const as = Debug.dualWithTrace<
  <OutDone2>(
    value: OutDone2
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    value: OutDone2
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutDone2>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      value: OutDone2
    ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> => map(self, () => value).traced(trace)
)

/** @internal */
export const asUnit = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, void> => map(self, constVoid).traced(trace)
)

/** @internal */
export const buffer = Debug.methodWithTrace((trace) =>
  <InErr, InElem, InDone>(
    empty: InElem,
    isEmpty: Predicate<InElem>,
    ref: Ref.Ref<InElem>
  ): Channel.Channel<never, InErr, InElem, InDone, InErr, InElem, InDone> =>
    core.suspend<never, InErr, InElem, InDone, InErr, InElem, InDone>(() => {
      const doBuffer = <InErr, InElem, InDone>(
        empty: InElem,
        isEmpty: Predicate<InElem>,
        ref: Ref.Ref<InElem>
      ): Channel.Channel<never, InErr, InElem, InDone, InErr, InElem, InDone> =>
        unwrap(
          Ref.modify(ref, (inElem) =>
            isEmpty(inElem) ?
              [
                core.readWith(
                  (input: InElem) =>
                    core.flatMap(
                      core.write(input),
                      () => doBuffer<InErr, InElem, InDone>(empty, isEmpty, ref)
                    ),
                  (error: InErr) => core.fail(error),
                  (done: InDone) => core.succeedNow(done)
                ),
                inElem
              ] as const :
              [
                core.flatMap(
                  core.write(inElem),
                  () => doBuffer<InErr, InElem, InDone>(empty, isEmpty, ref)
                ),
                empty
              ] as const)
        )
      return doBuffer(empty, isEmpty, ref)
    }).traced(trace)
)

/** @internal */
export const bufferChunk = Debug.methodWithTrace((trace) =>
  <InErr, InElem, InDone>(
    ref: Ref.Ref<Chunk.Chunk<InElem>>
  ): Channel.Channel<never, InErr, Chunk.Chunk<InElem>, InDone, InErr, Chunk.Chunk<InElem>, InDone> =>
    buffer<InErr, Chunk.Chunk<InElem>, InDone>(Chunk.empty(), Chunk.isEmpty, ref).traced(trace)
)

/** @internal */
export const catchAll = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
    f: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
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
    f: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
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
      f: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr1,
      OutElem | OutElem1,
      OutDone | OutDone1
    > =>
      core.catchAllCause(self, (cause) =>
        Either.match(
          Cause.failureOrCause(cause),
          restore(f),
          core.failCause
        )).traced(trace)
)

/** @internal */
export const concatMap = Debug.dualWithTrace<
  <OutElem, OutElem2, Env2, InErr2, InElem2, InDone2, OutErr2, _>(
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, _>
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    unknown
  >,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, OutElem2, Env2, InErr2, InElem2, InDone2, OutErr2, _>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, _>
  ) => Channel.Channel<
    Env2 | Env,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr2 | OutErr,
    OutElem2,
    unknown
  >
>(
  2,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, OutElem2, Env2, InErr2, InElem2, InDone2, OutErr2, _>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, _>
    ): Channel.Channel<
      Env | Env2,
      InErr & InErr2,
      InElem & InElem2,
      InDone & InDone2,
      OutErr | OutErr2,
      OutElem2,
      unknown
    > => core.concatMapWith(self, restore(f), () => void 0, () => void 0).traced(trace)
)

/** @internal */
export const collect = Debug.dualWithTrace<
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutElem2, OutDone>(
    pf: (o: OutElem) => Option.Option<OutElem2>
  ) => (
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutElem2, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    pf: (o: OutElem) => Option.Option<OutElem2>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone>
>(2, (trace, restore) =>
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    OutElem,
    OutElem2,
    OutDone
  >(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    pf: (o: OutElem) => Option.Option<OutElem2>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> => {
    const collector: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, OutElem2, OutDone> = core
      .readWith(
        (out) =>
          Option.match(
            restore(pf)(out),
            () => collector,
            (out2) => core.flatMap(core.write(out2), () => collector)
          ),
        core.fail,
        core.succeedNow
      )
    return core.pipeTo(self, collector).traced(trace)
  })

/** @internal */
export const concatOut = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown>,
      OutDone
    >
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown> => core.concatAll(self).traced(trace)
)

/** @internal */
export const contramap = Debug.dualWithTrace<
  <InDone0, InDone>(
    f: (a: InDone0) => InDone
  ) => <Env, InErr, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone>,
  <Env, InErr, InElem, OutErr, OutElem, OutDone, InDone0, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InDone0) => InDone
  ) => Channel.Channel<Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InElem, OutErr, OutElem, OutDone, InDone0, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InDone0) => InDone
  ): Channel.Channel<Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr, InElem, InDone0, InErr, InElem, InDone> = core.readWith(
      (inElem: InElem) => core.flatMap(core.write(inElem), () => reader),
      core.fail,
      (done: InDone0) => core.succeedNow(restore(f)(done))
    )
    return core.pipeTo(reader, self).traced(trace)
  })

/** @internal */
export const contramapEffect = Debug.dualWithTrace<
  <Env1, InErr, InDone0, InDone>(
    f: (i: InDone0) => Effect.Effect<Env1, InErr, InDone>
  ) => <Env, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone>,
  <Env, InElem, OutErr, OutElem, OutDone, Env1, InErr, InDone0, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (i: InDone0) => Effect.Effect<Env1, InErr, InDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InElem, OutErr, OutElem, OutDone, Env1, InErr, InDone0, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (i: InDone0) => Effect.Effect<Env1, InErr, InDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone0, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr, InElem, InDone0, InErr, InElem, InDone> = core.readWith(
      (inElem) => core.flatMap(core.write(inElem), () => reader),
      core.fail,
      (done) => core.fromEffect(restore(f)(done))
    )
    return core.pipeTo(reader, self).traced(trace)
  })

/** @internal */
export const contramapError = Debug.dualWithTrace<
  <InErr0, InErr>(
    f: (a: InErr0) => InErr
  ) => <Env, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, InElem, InDone, OutErr, OutElem, OutDone, InErr0, InErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InErr0) => InErr
  ) => Channel.Channel<Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InElem, InDone, OutErr, OutElem, OutDone, InErr0, InErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InErr0) => InErr
  ): Channel.Channel<Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr0, InElem, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem: InElem) => core.flatMap(core.write(inElem), () => reader),
      (error) => core.fail(restore(f)(error)),
      core.succeedNow
    )
    return core.pipeTo(reader, self).traced(trace)
  })

/** @internal */
export const contramapErrorEffect = Debug.dualWithTrace<
  <Env1, InErr0, InErr, InDone>(
    f: (error: InErr0) => Effect.Effect<Env1, InErr, InDone>
  ) => <Env, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, InElem, OutErr, OutElem, OutDone, Env1, InErr0, InErr, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (error: InErr0) => Effect.Effect<Env1, InErr, InDone>
  ) => Channel.Channel<Env1 | Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InElem, OutErr, OutElem, OutDone, Env1, InErr0, InErr, InDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (error: InErr0) => Effect.Effect<Env1, InErr, InDone>
  ): Channel.Channel<Env | Env1, InErr0, InElem, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr0, InElem, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) => core.flatMap(core.write(inElem), () => reader),
      (error) => core.fromEffect(restore(f)(error)),
      core.succeedNow
    )
    return core.pipeTo(reader, self).traced(trace)
  })

/** @internal */
export const contramapIn = Debug.dualWithTrace<
  <InElem0, InElem>(
    f: (a: InElem0) => InElem
  ) => <Env, InErr, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone>,
  <Env, InErr, InDone, OutErr, OutElem, OutDone, InElem0, InElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InElem0) => InElem
  ) => Channel.Channel<Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InDone, OutErr, OutElem, OutDone, InElem0, InElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InElem0) => InElem
  ): Channel.Channel<Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr, InElem0, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) => core.flatMap(core.write(restore(f)(inElem)), () => reader),
      core.fail,
      core.succeedNow
    )
    return core.pipeTo(reader, self).traced(trace)
  })

export const contramapInEffect = Debug.dualWithTrace<
  <Env1, InErr, InElem0, InElem>(
    f: (a: InElem0) => Effect.Effect<Env1, InErr, InElem>
  ) => <Env, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone>,
  <Env, InDone, OutErr, OutElem, OutDone, Env1, InErr, InElem0, InElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InElem0) => Effect.Effect<Env1, InErr, InElem>
  ) => Channel.Channel<Env1 | Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InDone, OutErr, OutElem, OutDone, Env1, InErr, InElem0, InElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (a: InElem0) => Effect.Effect<Env1, InErr, InElem>
  ): Channel.Channel<Env | Env1, InErr, InElem0, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr, InElem0, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) => core.flatMap(core.flatMap(core.fromEffect(restore(f)(inElem)), core.write), () => reader),
      core.fail,
      core.succeedNow
    )
    return core.pipeTo(reader, self).traced(trace)
  })

/** @internal */
export const doneCollect = Debug.methodWithTrace((trace) =>
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
  > =>
    core.suspend(() => {
      const builder: Array<OutElem> = []
      return pipe(
        core.pipeTo(self, doneCollectReader<Env, OutErr, OutElem, OutDone>(builder)),
        core.flatMap((outDone) => core.succeed([Chunk.unsafeFromArray(builder), outDone] as const))
      ).traced(trace)
    })
)

/** @internal */
const doneCollectReader = <Env, OutErr, OutElem, OutDone>(
  builder: Array<OutElem>
): Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, never, OutDone> => {
  return core.readWith(
    (outElem) =>
      core.flatMap(
        core.sync(() => {
          builder.push(outElem)
        }),
        () => doneCollectReader<Env, OutErr, OutElem, OutDone>(builder)
      ),
    core.fail,
    core.succeed
  )
}

/** @internal */
export const drain = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, never, OutDone> => {
    const drainer: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, never, OutDone> = core
      .readWithCause(
        () => drainer,
        core.failCause,
        core.succeed
      )
    return core.pipeTo(self, drainer).traced(trace)
  }
)

/** @internal */
export const emitCollect = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone], void> =>
    core.flatMap(doneCollect(self), core.write).traced(trace)
)

/** @internal */
export const ensuring = Debug.dualWithTrace<
  <Env1, Z>(
    finalizer: Effect.Effect<Env1, never, Z>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    finalizer: Effect.Effect<Env1, never, Z>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(2, (trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    finalizer: Effect.Effect<Env1, never, Z>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    core.ensuringWith(self, () => finalizer).traced(trace))

/** @internal */
export const context = Debug.methodWithTrace((trace) =>
  <Env>(): Channel.Channel<
    Env,
    unknown,
    unknown,
    unknown,
    never,
    never,
    Context.Context<Env>
  > => core.fromEffect(Effect.context<Env>()).traced(trace)
)

/** @internal */
export const contextWith = Debug.methodWithTrace((trace, restore) =>
  <Env, OutDone>(
    f: (env: Context.Context<Env>) => OutDone
  ): Channel.Channel<Env, unknown, unknown, unknown, never, never, OutDone> =>
    map(context<Env>(), restore(f)).traced(trace)
)

/** @internal */
export const contextWithChannel = Debug.methodWithTrace((trace, restore) =>
  <
    Env,
    Env1,
    InErr,
    InElem,
    InDone,
    OutErr,
    OutElem,
    OutDone
  >(
    f: (env: Context.Context<Env>) => Channel.Channel<Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    core.flatMap(context<Env>(), restore(f)).traced(trace)
)

/** @internal */
export const contextWithEffect = Debug.methodWithTrace((trace, restore) =>
  <Env, Env1, OutErr, OutDone>(
    f: (env: Context.Context<Env>) => Effect.Effect<Env1, OutErr, OutDone>
  ): Channel.Channel<Env | Env1, unknown, unknown, unknown, OutErr, never, OutDone> =>
    mapEffect(context<Env>(), restore(f)).traced(trace)
)

/** @internal */
export const flatten = Debug.methodWithTrace((trace) =>
  <
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
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      OutElem,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone2>
    >
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone2
  > => core.flatMap(self, identity).traced(trace)
)

/** @internal */
export const foldChannel = Debug.dualWithTrace<
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
    OutErr1,
    OutErr2,
    OutElem1,
    OutElem2,
    OutDone,
    OutDone1,
    OutDone2
  >(
    onError: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
    onSuccess: (done: OutDone) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone2>
  ) => <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env2 | Env,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr1 | OutErr2,
    OutElem1 | OutElem2 | OutElem,
    OutDone1 | OutDone2
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
    OutErr1,
    OutErr2,
    OutElem1,
    OutElem2,
    OutDone,
    OutDone1,
    OutDone2
  >(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    onError: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
    onSuccess: (done: OutDone) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone2>
  ) => Channel.Channel<
    Env1 | Env2 | Env,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr1 | OutErr2,
    OutElem1 | OutElem2 | OutElem,
    OutDone1 | OutDone2
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
      OutErr1,
      OutErr2,
      OutElem1,
      OutElem2,
      OutDone,
      OutDone1,
      OutDone2
    >(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      onError: (
        error: OutErr
      ) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
      onSuccess: (
        done: OutDone
      ) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone2>
    ): Channel.Channel<
      Env | Env1 | Env2,
      InErr & InErr1 & InErr2,
      InElem & InElem1 & InElem2,
      InDone & InDone1 & InDone2,
      OutErr2 | OutErr1,
      OutElem | OutElem2 | OutElem1,
      OutDone2 | OutDone1
    > =>
      core.foldCauseChannel(
        self,
        (cause) => {
          const either = Cause.failureOrCause(cause)
          switch (either._tag) {
            case "Left": {
              return restore(onError)(either.left)
            }
            case "Right": {
              return core.failCause(either.right)
            }
          }
        },
        restore(onSuccess)
      ).traced(trace)
)

/** @internal */
export const fromEither = Debug.methodWithTrace((trace) =>
  <E, A>(
    either: Either.Either<E, A>
  ): Channel.Channel<never, unknown, unknown, unknown, E, never, A> =>
    core.suspend(() => Either.match(either, core.fail, core.succeed)).traced(trace)
)

/** @internal */
export const fromInput = Debug.methodWithTrace((trace) =>
  <Err, Elem, Done>(
    input: SingleProducerAsyncInput.AsyncInputConsumer<Err, Elem, Done>
  ): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> =>
    unwrap(
      input.takeWith(
        core.failCause,
        (elem) => core.flatMap(core.write(elem), () => fromInput(input)),
        core.succeed
      )
    ).traced(trace)
)

/** @internal */
export const fromHub = Debug.methodWithTrace((trace) =>
  <Err, Done, Elem>(
    hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
  ): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> =>
    unwrapScoped(Effect.map(Hub.subscribe(hub), fromQueue)).traced(trace)
)

/** @internal */
export const fromHubScoped = Debug.methodWithTrace((trace) =>
  <Err, Done, Elem>(
    hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
  ): Effect.Effect<Scope.Scope, never, Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done>> =>
    Effect.map(Hub.subscribe(hub), fromQueue).traced(trace)
)

/** @internal */
export const fromOption = Debug.methodWithTrace((trace) =>
  <A>(
    option: Option.Option<A>
  ): Channel.Channel<never, unknown, unknown, unknown, Option.Option<never>, never, A> =>
    core.suspend(() => Option.match(option, () => core.fail(Option.none()), core.succeed)).traced(trace)
)

/** @internal */
export const fromQueue = Debug.methodWithTrace((trace) =>
  <Err, Elem, Done>(
    queue: Queue.Dequeue<Either.Either<Exit.Exit<Err, Done>, Elem>>
  ): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> =>
    core.suspend(() => fromQueueInternal(queue)).traced(trace)
)

/** @internal */
const fromQueueInternal = <Err, Elem, Done>(
  queue: Queue.Dequeue<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> =>
  pipe(
    core.fromEffect(Queue.take(queue)),
    core.flatMap(Either.match(
      Exit.match<Err, Done, Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done>>(
        core.failCause,
        core.succeedNow
      ),
      (elem) =>
        pipe(
          core.write(elem),
          core.flatMap(() => fromQueueInternal<Err, Elem, Done>(queue))
        )
    ))
  )

/** @internal */
export const identityChannel = Debug.methodWithTrace((trace) =>
  <Err, Elem, Done>(): Channel.Channel<never, Err, Elem, Done, Err, Elem, Done> =>
    core.readWith(
      (input: Elem) => core.flatMap(core.write(input), () => identityChannel<Err, Elem, Done>()),
      core.fail,
      core.succeedNow
    ).traced(trace)
)

/** @internal */
export const interruptWhen = Debug.dualWithTrace<
  <Env1, OutErr1, OutDone1>(
    effect: Effect.Effect<Env1, OutErr1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, OutErr1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    effect: Effect.Effect<Env1, OutErr1, OutDone1>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone>
>(2, (trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, OutErr1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    effect: Effect.Effect<Env1, OutErr1, OutDone1>
  ): Channel.Channel<
    Env1 | Env,
    InErr,
    InElem,
    InDone,
    OutErr | OutErr1,
    OutElem,
    OutDone | OutDone1
  > =>
    mergeWith(
      self,
      core.fromEffect(effect),
      (selfDone) => mergeDecision.Done(Effect.done(selfDone)),
      (effectDone) => mergeDecision.Done(Effect.done(effectDone))
    ).traced(trace))

/** @internal */
export const interruptWhenDeferred = Debug.dualWithTrace<
  <OutErr1, OutDone1>(
    deferred: Deferred.Deferred<OutErr1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutErr1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    deferred: Deferred.Deferred<OutErr1, OutDone1>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1 | OutDone>
>(2, (trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutErr1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    deferred: Deferred.Deferred<OutErr1, OutDone1>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr | OutErr1, OutElem, OutDone | OutDone1> =>
    interruptWhen(self, Deferred.await(deferred)).traced(trace))

/** @internal */
export const map = Debug.dualWithTrace<
  <OutDone, OutDone2>(
    f: (out: OutDone) => OutDone2
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (out: OutDone) => OutDone2
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (out: OutDone) => OutDone2
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> =>
    core.flatMap(self, (a) => core.sync(() => restore(f)(a))).traced(trace))

/** @internal */
export const mapEffect = Debug.dualWithTrace<
  <Env1, OutErr1, OutDone, OutDone1>(
    f: (o: OutDone) => Effect.Effect<Env1, OutErr1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, Env1, OutErr1, OutDone, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutDone) => Effect.Effect<Env1, OutErr1, OutDone1>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem, OutDone1>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, Env1, OutErr1, OutDone, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutDone) => Effect.Effect<Env1, OutErr1, OutDone1>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr | OutErr1, OutElem, OutDone1> =>
    core.flatMap(self, (z) => core.fromEffect(restore(f)(z))).traced(trace))

/** @internal */
export const mapError = Debug.dualWithTrace<
  <OutErr, OutErr2>(
    f: (err: OutErr) => OutErr2
  ) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr, OutErr2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (err: OutErr) => OutErr2
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr, OutErr2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (err: OutErr) => OutErr2
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> =>
    mapErrorCause(self, Cause.map(restore(f))).traced(trace))

/** @internal */
export const mapErrorCause = Debug.dualWithTrace<
  <OutErr, OutErr2>(
    f: (cause: Cause.Cause<OutErr>) => Cause.Cause<OutErr2>
  ) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr, OutErr2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (cause: Cause.Cause<OutErr>) => Cause.Cause<OutErr2>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr, OutErr2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (cause: Cause.Cause<OutErr>) => Cause.Cause<OutErr2>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> =>
    core.catchAllCause(self, (cause) => core.failCause(restore(f)(cause))).traced(trace))

/** @internal */
export const mapOut = Debug.dualWithTrace<
  <OutElem, OutElem2>(
    f: (o: OutElem) => OutElem2
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, OutElem2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => OutElem2
  ) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, OutElem2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => OutElem2
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> => {
    const reader: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, OutElem2, OutDone> = core
      .readWith(
        (outElem) => core.flatMap(core.write(restore(f)(outElem)), () => reader),
        core.fail,
        core.succeedNow
      )
    return core.pipeTo(self, reader).traced(trace)
  })

/** @internal */
export const mapOutEffect = Debug.dualWithTrace<
  <OutElem, Env1, OutErr1, OutElem1>(
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, OutErr1, OutElem1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone>
>(2, (trace, restore) =>
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, OutErr1, OutElem1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr | OutErr1, OutElem1, OutDone> => {
    const reader: Channel.Channel<Env | Env1, OutErr, OutElem, OutDone, OutErr | OutErr1, OutElem1, OutDone> = core
      .readWith(
        (outElem) =>
          pipe(
            core.fromEffect(restore(f)(outElem)),
            core.flatMap(core.write),
            core.flatMap(() => reader)
          ),
        core.fail,
        core.succeedNow
      )
    return core.pipeTo(self, reader).traced(trace)
  })

/** @internal */
export const mapOutEffectPar = Debug.dualWithTrace<
  <OutElem, Env1, OutErr1, OutElem1>(
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>,
    n: number
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, OutErr1, OutElem1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>,
    n: number
  ) => Channel.Channel<Env1 | Env, InErr, InElem, InDone, OutErr1 | OutErr, OutElem1, OutDone>
>(3, (trace, restoreTrace) =>
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, OutErr1, OutElem1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>,
    n: number
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr | OutErr1, OutElem1, OutDone> =>
    pipe(
      Effect.gen(function*($) {
        const queue = yield* $(
          Effect.acquireRelease(
            Queue.bounded<Effect.Effect<Env1, OutErr | OutErr1, Either.Either<OutDone, OutElem1>>>(n),
            Queue.shutdown
          )
        )
        const errorSignal = yield* $(Deferred.make<OutErr1, never>())
        const withPermits = n === Number.POSITIVE_INFINITY ?
          ((_: number) => identity) :
          (yield* $(Effect.makeSemaphore(n))).withPermits
        const pull = yield* $(toPull(self))
        yield* $(
          pipe(
            Effect.matchCauseEffect(
              pull,
              (cause) => Queue.offer(queue, Effect.failCause(cause)),
              (either) =>
                Either.match(
                  either,
                  (outDone) => {
                    const lock = withPermits(n)
                    return Effect.zipRight(
                      Effect.interruptible(lock(Effect.unit())),
                      Effect.asUnit(Queue.offer(
                        queue,
                        Effect.succeed(Either.left(outDone))
                      ))
                    )
                  },
                  (outElem) =>
                    Effect.gen(function*($) {
                      const deferred = yield* $(Deferred.make<OutErr1, OutElem1>())
                      const latch = yield* $(Deferred.make<never, void>())
                      yield* $(Effect.asUnit(Queue.offer(
                        queue,
                        Effect.map(Deferred.await(deferred), Either.right)
                      )))
                      yield* $(
                        pipe(
                          Deferred.succeed<never, void>(latch, void 0),
                          Effect.zipRight(
                            pipe(
                              Effect.uninterruptibleMask((restore) =>
                                pipe(
                                  Effect.exit(restore(Deferred.await(errorSignal))),
                                  Effect.raceFirst(Effect.exit(restore(restoreTrace(f)(outElem)))),
                                  Effect.flatMap(Effect.done)
                                )
                              ),
                              Effect.tapErrorCause((cause) => Deferred.failCause(errorSignal, cause)),
                              Effect.intoDeferred(deferred)
                            )
                          ),
                          withPermits(1),
                          Effect.forkScoped
                        )
                      )
                      yield* $(Deferred.await(latch))
                    })
                )
            ),
            Effect.forever,
            Effect.interruptible,
            Effect.forkScoped
          )
        )
        return queue
      }),
      Effect.map((queue) => {
        const consumer: Channel.Channel<
          Env1,
          unknown,
          unknown,
          unknown,
          OutErr | OutErr1,
          OutElem1,
          OutDone
        > = unwrap(
          Effect.matchCause(
            Effect.flatten(Queue.take(queue)),
            core.failCause,
            Either.match(
              core.succeedNow,
              (outElem) => core.flatMap(core.write(outElem), () => consumer)
            )
          )
        )
        return consumer
      }),
      unwrapScoped
    ).traced(trace))

/** @internal */
export const mergeAll = Debug.methodWithTrace((trace) =>
  (
    n: number,
    bufferSize = 16,
    mergeStrategy: MergeStrategy.MergeStrategy = _mergeStrategy.BackPressure()
  ) => {
    return <
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
      OutElem
    >(
      channels: Channel.Channel<
        Env,
        InErr,
        InElem,
        InDone,
        OutErr,
        Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, unknown>,
        unknown
      >
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem,
      unknown
    > => mergeAllWith(n, bufferSize, mergeStrategy)(channels, constVoid).traced(trace)
  }
)

/** @internal */
export const mergeAllUnbounded = Debug.methodWithTrace((trace) =>
  <
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
    OutElem
  >(
    channels: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, unknown>,
      unknown
    >
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem,
    unknown
  > => mergeAllWith(Number.POSITIVE_INFINITY)(channels, constVoid).traced(trace)
)

/** @internal */
export const mergeAllUnboundedWith = Debug.methodWithTrace((trace, restore) =>
  <
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
    channels: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, OutDone>,
      OutDone
    >,
    f: (o1: OutDone, o2: OutDone) => OutDone
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem,
    OutDone
  > => mergeAllWith(Number.POSITIVE_INFINITY)(channels, restore(f)).traced(trace)
)

/** @internal */
export const mergeAllWith = Debug.methodWithTrace((trace, restore) =>
  (
    n: number,
    bufferSize = 16,
    mergeStrategy: MergeStrategy.MergeStrategy = _mergeStrategy.BackPressure()
  ) =>
    <
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
      channels: Channel.Channel<
        Env,
        InErr,
        InElem,
        InDone,
        OutErr,
        Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem, OutDone>,
        OutDone
      >,
      f: (o1: OutDone, o2: OutDone) => OutDone
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem,
      OutDone
    > =>
      pipe(
        Effect.gen(function*($) {
          const input = yield* $(singleProducerAsyncInput.make<
            InErr & InErr1,
            InElem & InElem1,
            InDone & InDone1
          >())
          const queueReader = fromInput(input)
          const queue = yield* $(
            Effect.acquireRelease(
              Queue.bounded<Effect.Effect<Env, OutErr | OutErr1, Either.Either<OutDone, OutElem>>>(bufferSize),
              Queue.shutdown
            )
          )
          const cancelers = yield* $(
            Effect.acquireRelease(
              Queue.unbounded<Deferred.Deferred<never, void>>(),
              Queue.shutdown
            )
          )
          const lastDone = yield* $(Ref.make<Option.Option<OutDone>>(Option.none()))
          const errorSignal = yield* $(Deferred.make<never, void>())
          const withPermits = n === Number.POSITIVE_INFINITY ?
            ((_: number) => identity) :
            (yield* $(Effect.makeSemaphore(n))).withPermits
          const pull = yield* $(toPull(channels))
          const evaluatePull = (
            pull: Effect.Effect<Env | Env1, OutErr | OutErr1, Either.Either<OutDone, OutElem>>
          ) =>
            pipe(
              pull,
              Effect.flatMap(Either.match(
                (done) => Effect.succeed(Option.some(done)),
                (outElem) => pipe(Queue.offer(queue, Effect.succeed(Either.right(outElem))), Effect.as(Option.none()))
              )),
              Effect.repeatUntil(Option.isSome),
              Effect.flatMap(Option.match(
                () => Effect.unit(),
                (outDone) =>
                  Ref.update(
                    lastDone,
                    Option.match(
                      () => Option.some(outDone),
                      (lastDone) => Option.some(f(lastDone, outDone))
                    )
                  )
              )),
              Effect.catchAllCause((cause) =>
                Cause.isInterrupted(cause) ?
                  Effect.failCause(cause) :
                  pipe(
                    Queue.offer(queue, Effect.failCause(cause)),
                    Effect.zipRight(
                      Deferred.succeed<never, void>(errorSignal, void 0)
                    ),
                    Effect.asUnit
                  )
              )
            )
          yield* $(
            pipe(
              Effect.matchCauseEffect(
                pull,
                (cause) =>
                  pipe(
                    Queue.offer(queue, Effect.failCause(cause)),
                    Effect.zipRight(Effect.succeed(false))
                  ),
                Either.match(
                  (outDone) =>
                    pipe(
                      Deferred.await(errorSignal),
                      Effect.raceWith(
                        withPermits(n)(Effect.unit()),
                        (_, permitAcquisition) => pipe(Fiber.interrupt(permitAcquisition), Effect.as(false)),
                        (_, failureAwait) =>
                          pipe(
                            Fiber.interrupt(failureAwait),
                            Effect.zipRight(
                              pipe(
                                Ref.get(lastDone),
                                Effect.flatMap(Option.match(
                                  () => Queue.offer(queue, Effect.succeed(Either.left(outDone))),
                                  (lastDone) =>
                                    Queue.offer(queue, Effect.succeed(Either.left(restore(f)(lastDone, outDone))))
                                )),
                                Effect.as(false)
                              )
                            )
                          )
                      )
                    ),
                  (channel) =>
                    pipe(
                      mergeStrategy,
                      _mergeStrategy.match(
                        () =>
                          Effect.gen(function*($) {
                            const latch = yield* $(Deferred.make<never, void>())
                            const raceEffects: Effect.Effect<Env | Env1, OutErr | OutErr1, void> = pipe(
                              queueReader,
                              core.pipeTo(channel),
                              toPull,
                              Effect.flatMap((pull) =>
                                pipe(
                                  evaluatePull(pull),
                                  Effect.raceAwait(Deferred.await(errorSignal))
                                )
                              ),
                              Effect.scoped
                            )
                            yield* $(
                              pipe(
                                Deferred.succeed<never, void>(latch, void 0),
                                Effect.zipRight(raceEffects),
                                withPermits(1),
                                Effect.forkScoped
                              )
                            )
                            yield* $(Deferred.await(latch))
                            const errored = yield* $(Deferred.isDone(errorSignal))
                            return !errored
                          }),
                        () =>
                          Effect.gen(function*($) {
                            const canceler = yield* $(Deferred.make<never, void>())
                            const latch = yield* $(Deferred.make<never, void>())
                            const size = yield* $(Queue.size(cancelers))
                            yield* $(
                              pipe(
                                Queue.take(cancelers),
                                Effect.flatMap((_) => Deferred.succeed<never, void>(_, void 0)),
                                Effect.when(() => size >= n)
                              )
                            )
                            yield* $(Queue.offer(cancelers, canceler))
                            const raceEffects: Effect.Effect<Env | Env1, OutErr | OutErr1, void> = pipe(
                              queueReader,
                              core.pipeTo(channel),
                              toPull,
                              Effect.flatMap((pull) =>
                                pipe(
                                  evaluatePull(pull),
                                  Effect.raceAwait(Deferred.await(errorSignal)),
                                  Effect.raceAwait(Deferred.await(canceler))
                                )
                              ),
                              Effect.scoped
                            )
                            yield* $(pipe(
                              Deferred.succeed<never, void>(latch, void 0),
                              Effect.zipRight(raceEffects),
                              withPermits(1),
                              Effect.forkScoped
                            ))
                            yield* $(Deferred.await(latch))
                            const errored = yield* $(Deferred.isDone(errorSignal))
                            return !errored
                          })
                      )
                    )
                )
              ),
              Effect.repeatWhileEquals(true),
              Effect.forkScoped
            )
          )
          return [queue, input] as const
        }),
        Effect.map(([queue, input]) => {
          const consumer: Channel.Channel<
            Env | Env1,
            unknown,
            unknown,
            unknown,
            OutErr | OutErr1,
            OutElem,
            OutDone
          > = pipe(
            Queue.take(queue),
            Effect.flatten,
            Effect.matchCause(
              core.failCause,
              Either.match(
                core.succeedNow,
                (outElem) => core.flatMap(core.write(outElem), () => consumer)
              )
            ),
            unwrap
          )
          return core.embedInput(consumer, input)
        }),
        unwrapScoped
      ).traced(trace)
)

/** @internal */
export const mergeMap = Debug.dualWithTrace<
  <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >
>(
  3,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      n: number
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeMapBufferStrategy(self, restore(f), n, 16, _mergeStrategy.BackPressure()).traced(trace)
)

/** @internal */
export const mergeMapBuffer = Debug.dualWithTrace<
  <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    bufferSize: number
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    bufferSize: number
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >
>(
  4,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      n: number,
      bufferSize: number
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeMapBufferStrategy(self, restore(f), n, bufferSize, _mergeStrategy.BackPressure()).traced(trace)
)

/** @internal */
export const mergeMapStrategy = Debug.dualWithTrace<
  <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    mergeStrategy: MergeStrategy.MergeStrategy
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    mergeStrategy: MergeStrategy.MergeStrategy
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >
>(
  4,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      n: number,
      mergeStrategy: MergeStrategy.MergeStrategy
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeMapBufferStrategy(self, restore(f), n, 16, mergeStrategy).traced(trace)
)

/** @internal */
export const mergeMapBufferStrategy = Debug.dualWithTrace<
  <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    bufferSize: number,
    mergeStrategy: MergeStrategy.MergeStrategy
  ) => <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >,
  <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
    n: number,
    bufferSize: number,
    mergeStrategy: MergeStrategy.MergeStrategy
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1,
    unknown
  >
>(
  5,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutDone, OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      n: number,
      bufferSize: number,
      mergeStrategy: MergeStrategy.MergeStrategy
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeAll(n, bufferSize, mergeStrategy)(mapOut(self, restore(f))).traced(trace)
)

/** @internal */
export const mergeOut = Debug.dualWithTrace<
  (
    n: number
  ) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone, Z>(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      OutDone
    >
  ) => Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    unknown
  >,
  <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone, Z>(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      OutDone
    >,
    n: number
  ) => Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    unknown
  >
>(
  2,
  (trace) =>
    <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone, Z>(
      self: Channel.Channel<
        Env,
        InErr,
        InElem,
        InDone,
        OutErr,
        Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
        OutDone
      >,
      n: number
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeAll(n)(mapOut(self, identity)).traced(trace)
)

/** @internal */
export const mergeOutWith = Debug.dualWithTrace<
  <OutDone1>(
    n: number,
    f: (o1: OutDone1, o2: OutDone1) => OutDone1
  ) => <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1>(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
      OutDone1
    >
  ) => Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    OutDone1
  >,
  <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
      OutDone1
    >,
    n: number,
    f: (o1: OutDone1, o2: OutDone1) => OutDone1
  ) => Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    OutDone1
  >
>(
  3,
  (trace, restore) =>
    <Env, Env1, InErr, InErr1, InElem, InElem1, InDone, InDone1, OutErr, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<
        Env,
        InErr,
        InElem,
        InDone,
        OutErr,
        Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
        OutDone1
      >,
      n: number,
      f: (o1: OutDone1, o2: OutDone1) => OutDone1
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      OutDone1
    > => mergeAllWith(n)(mapOut(self, identity), restore(f)).traced(trace)
)

/** @internal */
export const mergeWith = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr, OutErr1, OutErr2, OutErr3, OutElem1, OutDone, OutDone1, OutDone2, OutDone3>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
    leftDone: (
      exit: Exit.Exit<OutErr, OutDone>
    ) => MergeDecision.MergeDecision<Env1, OutErr1, OutDone1, OutErr2, OutDone2>,
    rightDone: (
      ex: Exit.Exit<OutErr1, OutDone1>
    ) => MergeDecision.MergeDecision<Env1, OutErr, OutDone, OutErr3, OutDone3>
  ) => <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr2 | OutErr3,
    OutElem1 | OutElem,
    OutDone2 | OutDone3
  >,
  <
    Env,
    InErr,
    InElem,
    InDone,
    OutElem,
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
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
    leftDone: (
      exit: Exit.Exit<OutErr, OutDone>
    ) => MergeDecision.MergeDecision<Env1, OutErr1, OutDone1, OutErr2, OutDone2>,
    rightDone: (
      ex: Exit.Exit<OutErr1, OutDone1>
    ) => MergeDecision.MergeDecision<Env1, OutErr, OutDone, OutErr3, OutDone3>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr2 | OutErr3,
    OutElem1 | OutElem,
    OutDone2 | OutDone3
  >
>(
  4,
  (trace, restore) =>
    <
      Env,
      InErr,
      InElem,
      InDone,
      OutElem,
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
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
      leftDone: (
        exit: Exit.Exit<OutErr, OutDone>
      ) => MergeDecision.MergeDecision<Env1, OutErr1, OutDone1, OutErr2, OutDone2>,
      rightDone: (
        ex: Exit.Exit<OutErr1, OutDone1>
      ) => MergeDecision.MergeDecision<Env1, OutErr, OutDone, OutErr3, OutDone3>
    ): Channel.Channel<
      Env1 | Env,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr2 | OutErr3,
      OutElem | OutElem1,
      OutDone2 | OutDone3
    > =>
      unwrapScoped(
        pipe(
          singleProducerAsyncInput.make<
            InErr & InErr1,
            InElem & InElem1,
            InDone & InDone1
          >(),
          Effect.flatMap((input) => {
            const queueReader = fromInput(input)
            return Effect.map(
              Effect.zip(
                toPull(core.pipeTo(queueReader, self)),
                toPull(core.pipeTo(queueReader, that))
              ),
              ([pullL, pullR]) => {
                type State = MergeState.MergeState<
                  Env | Env1,
                  OutErr,
                  OutErr1,
                  OutErr2 | OutErr3,
                  OutElem | OutElem1,
                  OutDone,
                  OutDone1,
                  OutDone2 | OutDone3
                >

                const handleSide = <Err, Done, Err2, Done2>(
                  exit: Exit.Exit<Err, Either.Either<Done, OutElem | OutElem1>>,
                  fiber: Fiber.Fiber<Err2, Either.Either<Done2, OutElem | OutElem1>>,
                  pull: Effect.Effect<Env | Env1, Err, Either.Either<Done, OutElem | OutElem1>>
                ) =>
                  (
                    done: (
                      ex: Exit.Exit<Err, Done>
                    ) => MergeDecision.MergeDecision<
                      Env | Env1,
                      Err2,
                      Done2,
                      OutErr2 | OutErr3,
                      OutDone2 | OutDone3
                    >,
                    both: (
                      f1: Fiber.Fiber<Err, Either.Either<Done, OutElem | OutElem1>>,
                      f2: Fiber.Fiber<Err2, Either.Either<Done2, OutElem | OutElem1>>
                    ) => State,
                    single: (
                      f: (
                        ex: Exit.Exit<Err2, Done2>
                      ) => Effect.Effect<Env | Env1, OutErr2 | OutErr3, OutDone2 | OutDone3>
                    ) => State
                  ): Effect.Effect<
                    Env | Env1,
                    never,
                    Channel.Channel<
                      Env | Env1,
                      unknown,
                      unknown,
                      unknown,
                      OutErr2 | OutErr3,
                      OutElem | OutElem1,
                      OutDone2 | OutDone3
                    >
                  > => {
                    const onDecision = (
                      decision: MergeDecision.MergeDecision<
                        Env | Env1,
                        Err2,
                        Done2,
                        OutErr2 | OutErr3,
                        OutDone2 | OutDone3
                      >
                    ): Effect.Effect<
                      never,
                      never,
                      Channel.Channel<
                        Env | Env1,
                        unknown,
                        unknown,
                        unknown,
                        OutErr2 | OutErr3,
                        OutElem | OutElem1,
                        OutDone2 | OutDone3
                      >
                    > => {
                      const op = decision as mergeDecision.Primitive
                      if (op._tag === MergeDecisionOpCodes.OP_DONE) {
                        return Effect.succeed(
                          core.fromEffect(
                            Effect.zipRight(
                              Fiber.interrupt(fiber),
                              op.effect
                            )
                          )
                        )
                      }
                      return Effect.map(
                        Fiber.await(fiber),
                        Exit.match(
                          (cause) => core.fromEffect(op.f(Exit.failCause(cause))),
                          Either.match(
                            (done) => core.fromEffect(op.f(Exit.succeed(done))),
                            (elem) =>
                              zipRight(
                                core.write(elem),
                                go(single(op.f))
                              )
                          )
                        )
                      )
                    }

                    return Exit.match(
                      exit,
                      (cause) => onDecision(done(Exit.failCause(cause))),
                      Either.match(
                        (z) => onDecision(done(Exit.succeed(z))),
                        (elem) =>
                          Effect.succeed(
                            core.flatMap(core.write(elem), () =>
                              core.flatMap(
                                core.fromEffect(Effect.forkDaemon(pull)),
                                (leftFiber) => go(both(leftFiber, fiber))
                              ))
                          )
                      )
                    )
                  }

                const go = (
                  state: State
                ): Channel.Channel<
                  Env | Env1,
                  unknown,
                  unknown,
                  unknown,
                  OutErr2 | OutErr3,
                  OutElem | OutElem1,
                  OutDone2 | OutDone3
                > => {
                  switch (state._tag) {
                    case MergeStateOpCodes.OP_BOTH_RUNNING: {
                      const leftJoin = Effect.interruptible(Fiber.join(state.left))
                      const rightJoin = Effect.interruptible(Fiber.join(state.right))
                      return unwrap(
                        Effect.raceWith(
                          leftJoin,
                          rightJoin,
                          (leftExit, rf) =>
                            Effect.zipRight(
                              Fiber.interrupt(rf),
                              handleSide(leftExit, state.right, pullL)(
                                restore(leftDone),
                                mergeState.BothRunning,
                                (f) => mergeState.LeftDone(f)
                              )
                            ),
                          (rightExit, lf) =>
                            Effect.zipRight(
                              Fiber.interrupt(lf),
                              handleSide(rightExit, state.left, pullR)(
                                restore(rightDone) as (
                                  ex: Exit.Exit<InErr1 | OutErr1, OutDone1>
                                ) => MergeDecision.MergeDecision<
                                  Env1 | Env,
                                  OutErr,
                                  OutDone,
                                  OutErr2 | OutErr3,
                                  OutDone2 | OutDone3
                                >,
                                (left, right) => mergeState.BothRunning(right, left),
                                (f) => mergeState.RightDone(f)
                              )
                            )
                        )
                      )
                    }
                    case MergeStateOpCodes.OP_LEFT_DONE: {
                      return unwrap(
                        Effect.map(
                          Effect.exit(pullR),
                          Exit.match(
                            (cause) => core.fromEffect(state.f(Exit.failCause(cause))),
                            Either.match(
                              (done) => core.fromEffect(state.f(Exit.succeed(done))),
                              (elem) => core.flatMap(core.write(elem), () => go(mergeState.LeftDone(state.f)))
                            )
                          )
                        )
                      )
                    }
                    case MergeStateOpCodes.OP_RIGHT_DONE: {
                      return unwrap(
                        Effect.map(
                          Effect.exit(pullL),
                          Exit.match(
                            (cause) => core.fromEffect(state.f(Exit.failCause(cause))),
                            Either.match(
                              (done) => core.fromEffect(state.f(Exit.succeed(done))),
                              (elem) => core.flatMap(core.write(elem), () => go(mergeState.RightDone(state.f)))
                            )
                          )
                        )
                      )
                    }
                  }
                }

                return pipe(
                  core.fromEffect(
                    Effect.zipWith(
                      Effect.forkDaemon(pullL),
                      Effect.forkDaemon(pullR),
                      (left, right): State =>
                        mergeState.BothRunning<
                          Env | Env1,
                          OutErr,
                          OutErr1,
                          OutErr2 | OutErr3,
                          OutElem | OutElem1,
                          OutDone,
                          OutDone1,
                          OutDone2 | OutDone3
                        >(left, right)
                    )
                  ),
                  core.flatMap(go),
                  core.embedInput(input)
                )
              }
            )
          })
        )
      ).traced(trace)
)

/** @internal */
export const never = Debug.methodWithTrace((trace) =>
  (): Channel.Channel<never, unknown, unknown, unknown, never, never, never> =>
    core.fromEffect(Effect.never()).traced(trace)
)

/** @internal */
export const orDie = Debug.dualWithTrace<
  <E>(
    error: LazyArg<E>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, E>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    error: LazyArg<E>
  ) => Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>
>(
  2,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, E>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      error: LazyArg<E>
    ): Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> =>
      orDieWith(self, restore(error)).traced(trace)
)

/** @internal */
export const orDieWith = Debug.dualWithTrace<
  <OutErr>(
    f: (e: OutErr) => unknown
  ) => <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (e: OutErr) => unknown
  ) => Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>
>(
  2,
  (trace, restore) =>
    <Env, InErr, InElem, InDone, OutElem, OutDone, OutErr>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (e: OutErr) => unknown
    ): Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> =>
      catchAll(self, (e) => {
        throw restore(f)(e)
      }).traced(trace) as Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>
)

/** @internal */
export const orElse = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: LazyArg<Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
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
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: LazyArg<Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>>
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
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: LazyArg<Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr1,
      OutElem | OutElem1,
      OutDone | OutDone1
    > => catchAll(self, that).traced(trace)
)

/** @internal */
export const pipeToOrFail = Debug.dualWithTrace<
  <Env2, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    that: Channel.Channel<Env2, never, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => <Env, InErr, InElem, InDone, OutErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2 | OutErr, OutElem2, OutDone2>,
  <Env, InErr, InElem, InDone, OutErr, Env2, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env2, never, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
  ) => Channel.Channel<Env2 | Env, InErr, InElem, InDone, OutErr2 | OutErr, OutElem2, OutDone2>
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, Env2, OutElem, OutDone, OutErr2, OutElem2, OutDone2>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env2, never, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
    ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr | OutErr2, OutElem2, OutDone2> =>
      core.suspend(() => {
        let channelException: Channel.ChannelException<OutErr | OutErr2> | undefined = undefined

        const reader: Channel.Channel<Env, OutErr, OutElem, OutDone, never, OutElem, OutDone> = core
          .readWith(
            (outElem) => core.flatMap(core.write(outElem), () => reader),
            (outErr) => {
              channelException = ChannelException(outErr)
              return core.failCause(Cause.die(channelException))
            },
            core.succeedNow
          )

        const writer: Channel.Channel<
          Env2,
          OutErr2,
          OutElem2,
          OutDone2,
          OutErr2,
          OutElem2,
          OutDone2
        > = core.readWithCause(
          (outElem) => pipe(core.write(outElem), core.flatMap(() => writer)),
          (annotatedCause) => {
            const unannotated = Cause.unannotate(annotatedCause)
            return Cause.isDieType(unannotated) &&
                isChannelException(unannotated.defect) &&
                Equal.equals(unannotated.defect, channelException)
              ? core.fail(unannotated.defect.error as OutErr2)
              : core.failCause(annotatedCause)
          },
          core.succeedNow
        )

        return core.pipeTo(core.pipeTo(core.pipeTo(self, reader), that), writer).traced(trace)
      })
)

/** @internal */
export const provideService = Debug.dualWithTrace<
  <T extends Context.Tag<any, any>>(
    tag: T,
    service: Context.Tag.Service<T>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Exclude<Env, Context.Tag.Identifier<T>>, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, T extends Context.Tag<any, any>>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    tag: T,
    service: Context.Tag.Service<T>
  ) => Channel.Channel<Exclude<Env, Context.Tag.Identifier<T>>, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  3,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, T extends Context.Tag<any, any>>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      tag: T,
      service: Context.Tag.Service<T>
    ): Channel.Channel<Exclude<Env, Context.Tag.Identifier<T>>, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
      return core.flatMap(
        context<any>(),
        (context) => core.provideContext(self, Context.add(context, tag, service))
      ).traced(trace)
    }
)

/** @internal */
export const provideLayer = Debug.dualWithTrace<
  <Env0, Env, OutErr2>(
    layer: Layer.Layer<Env0, OutErr2, Env>
  ) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env0, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone>,
  <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env, OutErr2>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    layer: Layer.Layer<Env0, OutErr2, Env>
  ) => Channel.Channel<Env0, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone>
>(
  2,
  (trace) =>
    <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env, OutErr2>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      layer: Layer.Layer<Env0, OutErr2, Env>
    ): Channel.Channel<Env0, InErr, InElem, InDone, OutErr | OutErr2, OutElem, OutDone> =>
      unwrapScoped(Effect.map(Layer.build(layer), (env) => core.provideContext(self, env))).traced(trace)
)

/** @internal */
export const contramapContext = Debug.dualWithTrace<
  <Env0, Env>(
    f: (env: Context.Context<Env0>) => Context.Context<Env>
  ) => <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env0, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
  <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    f: (env: Context.Context<Env0>) => Context.Context<Env>
  ) => Channel.Channel<Env0, InErr, InElem, InDone, OutErr, OutElem, OutDone>
>(
  2,
  (trace, restore) =>
    <InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      f: (env: Context.Context<Env0>) => Context.Context<Env>
    ): Channel.Channel<Env0, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
      contextWithChannel(
        (context: Context.Context<Env0>) => core.provideContext(self, restore(f)(context))
      ).traced(trace)
)

/** @internal */
export const provideSomeLayer = Debug.dualWithTrace<
  <Env0, Env2, OutErr2>(
    layer: Layer.Layer<Env0, OutErr2, Env2>
  ) => <R, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<Env0 | Exclude<R, Env2>, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone>,
  <R, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env2, OutErr2>(
    self: Channel.Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    layer: Layer.Layer<Env0, OutErr2, Env2>
  ) => Channel.Channel<Env0 | Exclude<R, Env2>, InErr, InElem, InDone, OutErr2 | OutErr, OutElem, OutDone>
>(
  2,
  (trace) =>
    <R, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env0, Env2, OutErr2>(
      self: Channel.Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      layer: Layer.Layer<Env0, OutErr2, Env2>
    ): Channel.Channel<Env0 | Exclude<R, Env2>, InErr, InElem, InDone, OutErr | OutErr2, OutElem, OutDone> =>
      // @ts-expect-error
      provideLayer(self, Layer.merge(Layer.context<Exclude<R, Env2>>(), layer)).traced(trace)
)

/** @internal */
export const read = Debug.methodWithTrace((trace) =>
  <In>(): Channel.Channel<
    never,
    unknown,
    In,
    unknown,
    Option.Option<never>,
    never,
    In
  > => core.readOrFail<In, Option.Option<never>>(Option.none()).traced(trace)
)

/** @internal */
export const repeated = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    core.flatMap(self, () => repeated(self)).traced(trace)
)

/** @internal */
export const run = Debug.methodWithTrace((trace) =>
  <Env, InErr, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, never, OutDone>
  ): Effect.Effect<Env, OutErr, OutDone> => Effect.scoped(executor.runScoped(self)).traced(trace)
)

/** @internal */
export const runCollect = Debug.methodWithTrace((trace) =>
  <Env, InErr, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
  ): Effect.Effect<Env, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone]> =>
    executor.run(core.collectElements(self)).traced(trace)
)

/** @internal */
export const runDrain = Debug.methodWithTrace((trace) =>
  <Env, InErr, InDone, OutElem, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
  ): Effect.Effect<Env, OutErr, OutDone> => executor.run(drain(self)).traced(trace)
)

/** @internal */
export const scoped = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    effect: Effect.Effect<R | Scope.Scope, E, A>
  ): Channel.Channel<Exclude<R | Scope.Scope, Scope.Scope>, unknown, unknown, unknown, E, A, unknown> =>
    unwrap(
      Effect.uninterruptibleMask((restore) =>
        Effect.map(Scope.make(), (scope) =>
          core.acquireReleaseOut(
            Effect.tapErrorCause(
              restore(Scope.extend(scope)(effect)),
              (cause) => Scope.close(scope, Exit.failCause(cause))
            ),
            (_, exit) => Scope.close(scope, exit)
          ))
      )
    ).traced(trace)
)

/** @internal */
export const service = Debug.methodWithTrace((trace) =>
  <T extends Context.Tag<any, any>>(
    tag: T
  ): Channel.Channel<Context.Tag.Identifier<T>, unknown, unknown, unknown, never, never, Context.Tag.Service<T>> =>
    core.fromEffect(tag).traced(trace)
)

/** @internal */
export const serviceWith = Debug.methodWithTrace((trace, restore) =>
  <T extends Context.Tag<any, any>>(tag: T) =>
    <OutDone>(
      f: (resource: Context.Tag.Service<T>) => OutDone
    ): Channel.Channel<Context.Tag.Identifier<T>, unknown, unknown, unknown, never, never, OutDone> =>
      map(service(tag), restore(f)).traced(trace)
)

/** @internal */
export const serviceWithChannel = Debug.methodWithTrace((trace, restore) =>
  <T extends Context.Tag<any, any>>(tag: T) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
      f: (resource: Context.Tag.Service<T>) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
    ): Channel.Channel<Env | Context.Tag.Identifier<T>, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
      core.flatMap(service(tag), restore(f)).traced(trace)
)

/** @internal */
export const serviceWithEffect = Debug.methodWithTrace((trace, restore) =>
  <T extends Context.Tag<any, any>>(tag: T) =>
    <Env, OutErr, OutDone>(
      f: (resource: Context.Tag.Service<T>) => Effect.Effect<Env, OutErr, OutDone>
    ): Channel.Channel<Env | Context.Tag.Identifier<T>, unknown, unknown, unknown, OutErr, never, OutDone> =>
      mapEffect(service(tag), restore(f)).traced(trace)
)

/** @internal */
export const toHub = Debug.methodWithTrace((trace) =>
  <Err, Done, Elem>(
    hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
  ): Channel.Channel<never, Err, Elem, Done, never, never, unknown> => toQueue(hub).traced(trace)
)

/** @internal */
export const toPull = Debug.methodWithTrace((trace) =>
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Effect.Effect<Env | Scope.Scope, never, Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>>> =>
    Effect.map(
      Effect.acquireRelease(
        Effect.sync(() => new executor.ChannelExecutor(self, void 0, identity)),
        (exec, exit) => {
          const finalize = exec.close(exit)
          return finalize === undefined ? Effect.unit() : finalize
        }
      ),
      (exec) => Effect.suspend(() => interpretToPull(exec.run() as ChannelState.ChannelState<Env, OutErr>, exec))
    ).traced(trace)
)

/** @internal */
const interpretToPull = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  channelState: ChannelState.ChannelState<Env, OutErr>,
  exec: executor.ChannelExecutor<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>> => {
  const state = channelState as ChannelState.Primitive
  switch (state._tag) {
    case ChannelStateOpCodes.OP_DONE: {
      return Exit.match(
        exec.getDone(),
        Effect.failCause,
        (done): Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>> => Effect.succeed(Either.left(done))
      )
    }
    case ChannelStateOpCodes.OP_EMIT: {
      return Effect.succeed(Either.right(exec.getEmit()))
    }
    case ChannelStateOpCodes.OP_FROM_EFFECT: {
      return pipe(
        state.effect as Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>>,
        Effect.flatMap(() => interpretToPull(exec.run() as ChannelState.ChannelState<Env, OutErr>, exec))
      )
    }
    case ChannelStateOpCodes.OP_READ: {
      return executor.readUpstream(
        state,
        () => interpretToPull(exec.run() as ChannelState.ChannelState<Env, OutErr>, exec),
        (cause) => Effect.failCause(cause) as Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>>
      )
    }
  }
}

/** @internal */
export const toQueue = Debug.methodWithTrace((trace) =>
  <Err, Done, Elem>(
    queue: Queue.Enqueue<Either.Either<Exit.Exit<Err, Done>, Elem>>
  ): Channel.Channel<never, Err, Elem, Done, never, never, unknown> =>
    core.suspend(() => toQueueInternal(queue)).traced(trace)
)

/** @internal */
const toQueueInternal = <Err, Done, Elem>(
  queue: Queue.Enqueue<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, Err, Elem, Done, never, never, unknown> => {
  return core.readWithCause(
    (elem) =>
      core.flatMap(
        core.fromEffect(Queue.offer(queue, Either.right(elem))),
        () => toQueueInternal(queue)
      ),
    (cause) => core.fromEffect(pipe(Queue.offer(queue, Either.left(Exit.failCause(cause))))),
    (done) => core.fromEffect(pipe(Queue.offer(queue, Either.left(Exit.succeed(done)))))
  )
}

/** @internal */
export const unwrap = Debug.methodWithTrace((trace) =>
  <R, E, R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    channel: Effect.Effect<R, E, Channel.Channel<R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
  ): Channel.Channel<R | R2, InErr, InElem, InDone, E | OutErr, OutElem, OutDone> =>
    flatten(core.fromEffect(channel)).traced(trace)
)

/** @internal */
export const unwrapScoped = Debug.methodWithTrace((trace) =>
  <
    R,
    E,
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    OutElem,
    OutDone
  >(
    self: Effect.Effect<
      R | Scope.Scope,
      E,
      Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
    >
  ): Channel.Channel<
    Exclude<R | Scope.Scope, Scope.Scope> | Env,
    InErr,
    InElem,
    InDone,
    E | OutErr,
    OutElem,
    OutDone
  > =>
    core.concatAllWith(
      scoped(self),
      (d, _) => d,
      (d, _) => d
    ).traced(trace)
)

/** @internal */
export const updateService = Debug.dualWithTrace<
  <T extends Context.Tag<any, any>>(
    tag: T,
    f: (resource: Context.Tag.Service<T>) => Context.Tag.Service<T>
  ) => <R, InErr, InDone, OutElem, OutErr, OutDone>(
    self: Channel.Channel<R, InErr, unknown, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<T | R, InErr, unknown, InDone, OutErr, OutElem, OutDone>,
  <R, InErr, InDone, OutElem, OutErr, OutDone, T extends Context.Tag<any, any>>(
    self: Channel.Channel<R, InErr, unknown, InDone, OutErr, OutElem, OutDone>,
    tag: T,
    f: (resource: Context.Tag.Service<T>) => Context.Tag.Service<T>
  ) => Channel.Channel<T | R, InErr, unknown, InDone, OutErr, OutElem, OutDone>
>(
  3,
  (trace, restore) =>
    <R, InErr, InDone, OutElem, OutErr, OutDone, T extends Context.Tag<any, any>>(
      self: Channel.Channel<R, InErr, unknown, InDone, OutErr, OutElem, OutDone>,
      tag: T,
      f: (resource: Context.Tag.Service<T>) => Context.Tag.Service<T>
    ): Channel.Channel<R | T, InErr, unknown, InDone, OutErr, OutElem, OutDone> =>
      contramapContext(self, (context: Context.Context<R>) =>
        Context.merge(
          context,
          Context.make(tag, restore(f)(Context.unsafeGet(context, tag)))
        )).traced(trace)
)

/** @internal */
export const writeAll = Debug.methodWithTrace((trace) =>
  <OutElem>(
    ...outs: Array<OutElem>
  ): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> =>
    writeChunk(Chunk.fromIterable(outs)).traced(trace)
)

/** @internal */
export const writeChunk = Debug.methodWithTrace((trace) =>
  <OutElem>(
    outs: Chunk.Chunk<OutElem>
  ): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> =>
    writeChunkWriter(0, outs.length, outs).traced(trace)
)

/** @internal */
const writeChunkWriter = <OutElem>(
  idx: number,
  len: number,
  chunk: Chunk.Chunk<OutElem>
): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> => {
  return idx === len
    ? core.unit()
    : pipe(
      core.write(pipe(chunk, Chunk.unsafeGet(idx))),
      core.flatMap(() => writeChunkWriter(idx + 1, len, chunk))
    )
}

/** @internal */
export const zip = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    readonly [OutDone, OutDone1]
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    readonly [OutDone, OutDone1]
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      readonly [OutDone, OutDone1]
    > => core.flatMap(self, (a) => pipe(that, map((b) => [a, b] as const))).traced(trace)
)

/** @internal */
export const zipLeft = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      OutDone
    > => core.flatMap(self, (z) => as(that, z)).traced(trace)
)

/** @internal */
export const zipRight = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone1
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone1
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      OutDone1
    > => core.flatMap(self, () => that).traced(trace)
)

/** @internal */
export const zipPar = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    readonly [OutDone, OutDone1]
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    readonly [OutDone, OutDone1]
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env1 | Env,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      readonly [OutDone, OutDone1]
    > =>
      mergeWith(
        self,
        that,
        (exit1) => mergeDecision.Await((exit2) => Effect.done(Exit.zip(exit1, exit2))),
        (exit2) => mergeDecision.Await((exit1) => Effect.done(Exit.zip(exit1, exit2)))
      ).traced(trace)
)

/** @internal */
export const zipParLeft = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env1 | Env,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      OutDone
    > =>
      map(
        zipPar(self, that),
        (tuple) => tuple[0]
      ).traced(trace)
)

/** @internal */
export const zipParRight = Debug.dualWithTrace<
  <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone1
  >,
  <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
    that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
  ) => Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1 | OutErr,
    OutElem1 | OutElem,
    OutDone1
  >
>(
  2,
  (trace) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>,
      that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
    ): Channel.Channel<
      Env1 | Env,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem | OutElem1,
      OutDone1
    > => map(zipPar(self, that), (tuple) => tuple[1]).traced(trace)
)

/** @internal */
export const ChannelExceptionTypeId: Channel.ChannelExceptionTypeId = Symbol.for(
  "@effect/stream/Channel/errors/ChannelException"
) as Channel.ChannelExceptionTypeId

/** @internal */
export const ChannelException = <E>(error: E): Channel.ChannelException<E> => ({
  _tag: "ChannelException",
  [ChannelExceptionTypeId]: ChannelExceptionTypeId,
  error
})

/** @internal */
export const isChannelException = (u: unknown): u is Channel.ChannelException<unknown> =>
  typeof u === "object" && u != null && ChannelExceptionTypeId in u
