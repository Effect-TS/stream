import * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as Hub from "@effect/io/Hub"
import * as Layer from "@effect/io/Layer"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Scope from "@effect/io/Scope"
import * as TSemaphore from "@effect/stm/TSemaphore"
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
import * as Chunk from "@fp-ts/data/Chunk"
import * as Context from "@fp-ts/data/Context"
import * as Either from "@fp-ts/data/Either"
import * as Equal from "@fp-ts/data/Equal"
import type { LazyArg } from "@fp-ts/data/Function"
import { constVoid, identity, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/** @internal */
export const acquireUseRelease = <
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
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem1, OutDone> => {
  return pipe(
    Ref.make<(exit: Exit.Exit<OutErr, OutDone>) => Effect.Effect<Env, never, any>>(() => Effect.unit()),
    core.fromEffect,
    core.flatMap((ref) =>
      pipe(
        core.fromEffect(
          pipe(
            acquire,
            Effect.tap((a) => pipe(ref, Ref.set((exit) => release(a, exit)))),
            Effect.uninterruptible
          )
        ),
        core.flatMap(use),
        core.ensuringWith((exit) => pipe(Ref.get(ref), Effect.flatMap((f) => f(exit))))
      )
    )
  )
}

/** @internal */
export const as = <OutDone2>(value: OutDone2) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> => pipe(self, map(() => value))
}

/** @internal */
export const asUnit = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, void> => pipe(self, map(constVoid))

/** @internal */
export const buffer = <InErr, InElem, InDone>(
  empty: InElem,
  isEmpty: Predicate<InElem>,
  ref: Ref.Ref<InElem>
): Channel.Channel<never, InErr, InElem, InDone, InErr, InElem, InDone> =>
  core.suspend(() => {
    const doBuffer = <InErr, InElem, InDone>(
      empty: InElem,
      isEmpty: Predicate<InElem>,
      ref: Ref.Ref<InElem>
    ): Channel.Channel<never, InErr, InElem, InDone, InErr, InElem, InDone> =>
      pipe(
        ref,
        Ref.modify((inElem) =>
          isEmpty(inElem) ?
            [
              core.readWith(
                (input: InElem) =>
                  pipe(
                    core.write(input),
                    core.flatMap(() => doBuffer<InErr, InElem, InDone>(empty, isEmpty, ref))
                  ),
                (error: InErr) => core.fail(error),
                (done: InDone) => core.succeedNow(done)
              ),
              inElem
            ] as const :
            [
              pipe(
                core.write(inElem),
                core.flatMap(() => doBuffer<InErr, InElem, InDone>(empty, isEmpty, ref))
              ),
              empty
            ] as const
        ),
        unwrap
      )
    return doBuffer(empty, isEmpty, ref)
  })

/** @internal */
export const bufferChunk = <InErr, InElem, InDone>(
  ref: Ref.Ref<Chunk.Chunk<InElem>>
): Channel.Channel<never, InErr, Chunk.Chunk<InElem>, InDone, InErr, Chunk.Chunk<InElem>, InDone> =>
  buffer(Chunk.empty(), Chunk.isEmpty, ref)

/** @internal */
export const catchAll = <
  Env1,
  InErr1,
  InElem1,
  InDone1,
  OutErr,
  OutErr1,
  OutElem1,
  OutDone1
>(f: (error: OutErr) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>) => {
  return <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1,
    OutElem | OutElem1,
    OutDone | OutDone1
  > =>
    pipe(
      self,
      core.catchAllCause((cause) =>
        pipe(
          Cause.failureOrCause(cause),
          Either.match(f, core.failCause)
        )
      )
    )
}

/** @internal */
export const concatMap = <
  OutElem,
  OutElem2,
  Env2,
  InErr2,
  InElem2,
  InDone2,
  OutErr2,
  _
>(f: (o: OutElem) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, _>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env2,
    InErr & InErr2,
    InElem & InElem2,
    InDone & InDone2,
    OutErr | OutErr2,
    OutElem2,
    unknown
  > => pipe(self, core.concatMapWith(f, () => void 0, () => void 0))
}

/** @internal */
export const collect = <
  Env,
  InErr,
  InElem,
  InDone,
  OutErr,
  OutElem,
  OutElem2,
  OutDone
>(pf: (o: OutElem) => Option.Option<OutElem2>) => {
  return (
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> => {
    const collector: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, OutElem2, OutDone> = core
      .readWith(
        (out) =>
          pipe(
            pf(out),
            Option.match(
              () => collector,
              (out2) => pipe(core.write(out2), core.flatMap(() => collector))
            )
          ),
        core.fail,
        core.succeedNow
      )
    return pipe(self, core.pipeTo(collector))
  }
}

/** @internal */
export const concatOut = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<
    Env,
    InErr,
    InElem,
    InDone,
    OutErr,
    Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown>,
    OutDone
  >
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, unknown> => core.concatAll(self)

/** @internal */
export const contramap = <InDone0, InDone>(f: (a: InDone0) => InDone) => {
  return <Env, InErr, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone0, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr, InElem, InDone0, InErr, InElem, InDone> = core.readWith(
      (inElem: InElem) =>
        pipe(
          core.write(inElem),
          core.flatMap(() => reader)
        ),
      core.fail,
      (done: InDone0) => core.succeedNow(f(done))
    )
    return pipe(reader, core.pipeTo(self))
  }
}

/** @internal */
export const contramapEffect = <
  Env1,
  InErr,
  InDone0,
  InDone
>(f: (i: InDone0) => Effect.Effect<Env1, InErr, InDone>) => {
  return <Env, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone0, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr, InElem, InDone0, InErr, InElem, InDone> = core.readWith(
      (inElem) =>
        pipe(
          core.write(inElem),
          core.flatMap(() => reader)
        ),
      core.fail,
      (done) => core.fromEffect(f(done))
    )
    return pipe(reader, core.pipeTo(self))
  }
}

/** @internal */
export const contramapError = <InErr0, InErr>(f: (a: InErr0) => InErr) => {
  return <Env, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr0, InElem, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr0, InElem, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem: InElem) =>
        pipe(
          core.write(inElem),
          core.flatMap(() => reader)
        ),
      (error) => core.fail(f(error)),
      core.succeedNow
    )
    return pipe(reader, core.pipeTo(self))
  }
}

/** @internal */
export const contramapErrorEffect = <
  Env1,
  InErr0,
  InErr,
  InDone
>(f: (error: InErr0) => Effect.Effect<Env1, InErr, InDone>) => {
  return <Env, InElem, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr0, InElem, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr0, InElem, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) =>
        pipe(
          core.write(inElem),
          core.flatMap(() => reader)
        ),
      (error) => core.fromEffect(f(error)),
      core.succeedNow
    )
    return pipe(reader, core.pipeTo(self))
  }
}

/** @internal */
export const contramapIn = <InElem0, InElem>(f: (a: InElem0) => InElem) => {
  return <Env, InErr, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem0, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<never, InErr, InElem0, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) =>
        pipe(
          core.write(f(inElem)),
          core.flatMap(() => reader)
        ),
      core.fail,
      core.succeedNow
    )
    return pipe(reader, core.pipeTo(self))
  }
}

export const contramapInEffect = <
  Env1,
  InErr,
  InElem0,
  InElem
>(f: (a: InElem0) => Effect.Effect<Env1, InErr, InElem>) => {
  return <Env, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem0, InDone, OutErr, OutElem, OutDone> => {
    const reader: Channel.Channel<Env1, InErr, InElem0, InDone, InErr, InElem, InDone> = core.readWith(
      (inElem) =>
        pipe(
          core.fromEffect(f(inElem)),
          core.flatMap(core.write),
          core.flatMap(() => reader)
        ),
      core.fail,
      core.succeedNow
    )
    return pipe(reader, core.pipeTo(self))
  }
}

/** @internal */
export const doneCollect = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
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
  return core.suspend(() => {
    const builder: Array<OutElem> = []
    return pipe(
      self,
      core.pipeTo(doneCollectReader<Env, OutErr, OutElem, OutDone>(builder)),
      core.flatMap((outDone) => core.succeed([Chunk.unsafeFromArray(builder), outDone] as const))
    )
  })
}

/** @internal */
const doneCollectReader = <Env, OutErr, OutElem, OutDone>(
  builder: Array<OutElem>
): Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, never, OutDone> => {
  return core.readWith(
    (outElem) =>
      pipe(
        core.sync(() => {
          builder.push(outElem)
        }),
        core.flatMap(() => doneCollectReader<Env, OutErr, OutElem, OutDone>(builder))
      ),
    core.fail,
    core.succeed
  )
}

/** @internal */
export const drain = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, never, OutDone> => {
  const drainer: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, never, OutDone> = core
    .readWithCause(
      () => drainer,
      core.failCause,
      core.succeed
    )
  return pipe(self, core.pipeTo(drainer))
}

/** @internal */
export const emitCollect = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone], void> => {
  return pipe(doneCollect(self), core.flatMap(core.write))
}

/** @internal */
export const ensuring = <Env1, Z>(finalizer: Effect.Effect<Env1, never, Z>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    pipe(self, core.ensuringWith(() => finalizer))
}

/** @internal */
export const environment = <Env>(): Channel.Channel<
  Env,
  unknown,
  unknown,
  unknown,
  never,
  never,
  Context.Context<Env>
> => {
  return core.fromEffect(Effect.environment<Env>())
}

/** @internal */
export const environmentWith = <Env, OutDone>(
  f: (env: Context.Context<Env>) => OutDone
): Channel.Channel<Env, unknown, unknown, unknown, never, never, OutDone> => {
  return pipe(environment<Env>(), map(f))
}

/** @internal */
export function environmentWithChannel<
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
): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr, OutElem, OutDone> {
  return pipe(environment<Env>(), core.flatMap(f))
}

/** @internal */
export const environmentWithEffect = <Env, Env1, OutErr, OutDone>(
  f: (env: Context.Context<Env>) => Effect.Effect<Env1, OutErr, OutDone>
): Channel.Channel<Env | Env1, unknown, unknown, unknown, OutErr, never, OutDone> => {
  return pipe(environment<Env>(), mapEffect(f))
}

/** @internal */
export const flatten = <
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
> => pipe(self, core.flatMap(identity))

/** @internal */
export const foldChannel = <
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
  onError: (
    error: OutErr
  ) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
  onSuccess: (
    done: OutDone
  ) => Channel.Channel<Env2, InErr2, InElem2, InDone2, OutErr2, OutElem2, OutDone2>
) => {
  return <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1 | Env2,
    InErr & InErr1 & InErr2,
    InElem & InElem1 & InElem2,
    InDone & InDone1 & InDone2,
    OutErr2 | OutErr1,
    OutElem | OutElem2 | OutElem1,
    OutDone2 | OutDone1
  > =>
    pipe(
      self,
      core.foldCauseChannel(
        (cause) => {
          const either = Cause.failureOrCause(cause)
          switch (either._tag) {
            case "Left": {
              return onError(either.left)
            }
            case "Right": {
              return core.failCause(either.right)
            }
          }
        },
        onSuccess
      )
    )
}

/** @internal */
export const fromEither = <E, A>(
  either: Either.Either<E, A>
): Channel.Channel<never, unknown, unknown, unknown, E, never, A> =>
  core.suspend(() => pipe(either, Either.match(core.fail, core.succeed)))

/** @internal */
export const fromInput = <Err, Elem, Done>(
  input: SingleProducerAsyncInput.AsyncInputConsumer<Err, Elem, Done>
): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> => {
  return unwrap(
    input.takeWith(
      core.failCause,
      (elem) => pipe(core.write(elem), core.flatMap(() => fromInput(input))),
      core.succeed
    )
  )
}

/** @internal */
export const fromHub = <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> => {
  return unwrapScoped(pipe(Hub.subscribe(hub), Effect.map(fromQueue)))
}

/** @internal */
export const fromHubScoped = <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Effect.Effect<Scope.Scope, never, Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done>> => {
  const trace = getCallTrace()
  return pipe(Hub.subscribe(hub), Effect.map(fromQueue)).traced(trace)
}

/** @internal */
export const fromOption = <A>(
  option: Option.Option<A>
): Channel.Channel<never, unknown, unknown, unknown, Option.Option<never>, never, A> => {
  return core.suspend(() => pipe(option, Option.match(() => core.fail(Option.none), core.succeed)))
}

/** @internal */
export const fromQueue = <Err, Elem, Done>(
  queue: Queue.Dequeue<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, unknown, unknown, unknown, Err, Elem, Done> => {
  return core.suspend(() => fromQueueInternal(queue))
}

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
export const identityChannel = <Err, Elem, Done>(): Channel.Channel<never, Err, Elem, Done, Err, Elem, Done> =>
  core.readWith(
    (input: Elem) => pipe(core.write(input), core.flatMap(() => identityChannel<Err, Elem, Done>())),
    core.fail,
    core.succeedNow
  )

/** @internal */
export const interruptWhen = <
  Env1,
  OutErr1,
  OutDone1
>(effect: Effect.Effect<Env1, OutErr1, OutDone1>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env1 | Env,
    InErr,
    InElem,
    InDone,
    OutErr | OutErr1,
    OutElem,
    OutDone | OutDone1
  > =>
    pipe(
      self,
      mergeWith(
        core.fromEffect(effect),
        (selfDone) => mergeDecision.Done(Effect.done(selfDone)),
        (effectDone) => mergeDecision.Done(Effect.done(effectDone))
      )
    )
}

/** @internal */
export const interruptWhenDeferred = <
  OutErr1,
  OutDone1
>(deferred: Deferred.Deferred<OutErr1, OutDone1>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr | OutErr1, OutElem, OutDone | OutDone1> =>
    pipe(self, interruptWhen(Deferred.await(deferred)))
}

/** @internal */
export const map = <OutDone, OutDone2>(f: (out: OutDone) => OutDone2) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone2> =>
    pipe(
      self,
      core.flatMap((a) => core.sync(() => f(a)))
    )
}

/** @internal */
export const mapEffect = <
  Env1,
  OutErr1,
  OutDone,
  OutDone1
>(f: (o: OutDone) => Effect.Effect<Env1, OutErr1, OutDone1>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr | OutErr1, OutElem, OutDone1> =>
    pipe(self, core.flatMap((z) => core.fromEffect(f(z))))
}

/** @internal */
export const mapError = <OutErr, OutErr2>(f: (err: OutErr) => OutErr2) => {
  return <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> => pipe(self, mapErrorCause(Cause.map(f)))
}

/** @internal */
export const mapErrorCause = <OutErr, OutErr2>(
  f: (cause: Cause.Cause<OutErr>) => Cause.Cause<OutErr2>
) => {
  return <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr2, OutElem, OutDone> =>
    pipe(self, core.catchAllCause((cause) => core.failCause(f(cause))))
}

/** @internal */
export const mapOut = <OutElem, OutElem2>(f: (o: OutElem) => OutElem2) => {
  return <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem2, OutDone> => {
    const reader: Channel.Channel<Env, OutErr, OutElem, OutDone, OutErr, OutElem2, OutDone> = core
      .readWith(
        (outElem) => pipe(core.write(f(outElem)), core.flatMap(() => reader)),
        core.fail,
        core.succeedNow
      )
    return pipe(self, core.pipeTo(reader))
  }
}

/** @internal */
export const mapOutEffect = <OutElem, Env1, OutErr1, OutElem1>(
  f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env1, InErr, InElem, InDone, OutErr | OutErr1, OutElem1, OutDone> => {
    const reader: Channel.Channel<Env | Env1, OutErr, OutElem, OutDone, OutErr | OutErr1, OutElem1, OutDone> = core
      .readWith(
        (outElem) =>
          pipe(
            core.fromEffect(f(outElem)),
            core.flatMap(core.write),
            core.flatMap(() => reader)
          ),
        core.fail,
        core.succeedNow
      )
    return pipe(self, core.pipeTo(reader))
  }
}

/** @internal */
export const mapOutEffectPar = (n: number) => {
  return <OutElem, Env1, OutErr1, OutElem1>(
    f: (o: OutElem) => Effect.Effect<Env1, OutErr1, OutElem1>
  ) => {
    return <Env, InErr, InElem, InDone, OutErr, OutDone>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
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
          const permits = yield* $(TSemaphore.make(n))
          const pull = yield* $(toPull(self))
          yield* $(
            pipe(
              pull,
              Effect.foldCauseEffect(
                (cause) => pipe(queue, Queue.offer(Effect.failCause(cause))),
                (either) =>
                  pipe(
                    either,
                    Either.match(
                      (outDone) => {
                        const lock = pipe(permits, TSemaphore.withPermits(n))
                        return pipe(
                          lock(Effect.unit()),
                          Effect.interruptible,
                          Effect.zipRight(pipe(
                            queue,
                            Queue.offer(Effect.succeed(Either.left(outDone))),
                            Effect.asUnit
                          ))
                        )
                      },
                      (outElem) =>
                        Effect.gen(function*($) {
                          const deferred = yield* $(Deferred.make<OutErr1, OutElem1>())
                          const latch = yield* $(Deferred.make<never, void>())
                          yield* $(
                            pipe(
                              queue,
                              Queue.offer(pipe(Deferred.await(deferred), Effect.map(Either.right))),
                              Effect.asUnit
                            )
                          )
                          yield* $(
                            pipe(
                              latch,
                              Deferred.succeed<void>(void 0),
                              Effect.zipRight(
                                pipe(
                                  Effect.uninterruptibleMask((restore) =>
                                    pipe(
                                      restore(Deferred.await(errorSignal)),
                                      Effect.exit,
                                      Effect.raceFirst(pipe(restore(f(outElem)), Effect.exit)),
                                      Effect.flatMap(Effect.done)
                                    )
                                  ),
                                  Effect.tapErrorCause((cause) => pipe(errorSignal, Deferred.failCause(cause))),
                                  Effect.intoDeferred(deferred)
                                )
                              ),
                              TSemaphore.withPermit(permits),
                              Effect.forkScoped
                            )
                          )
                          yield* $(Deferred.await(latch))
                        })
                    )
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
          > = pipe(
            Queue.take(queue),
            Effect.flatten,
            Effect.foldCause(
              core.failCause,
              Either.match(
                core.succeedNow,
                (outElem) => pipe(core.write(outElem), core.flatMap(() => consumer))
              )
            ),
            unwrap
          )
          return consumer
        }),
        unwrapScoped
      )
  }
}

/**
 * @tsplus static effect/core/stream/Channel.Ops mergeAll
 */
export const mergeAll = (
  n: number,
  bufferSize = 16,
  mergeStrategy: MergeStrategy.MergeStrategy = _mergeStrategy.BackPressure
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
  > => mergeAllWith(n, bufferSize, mergeStrategy)(channels, constVoid)
}

/** @internal */
export const mergeAllUnbounded = <
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
> => mergeAllWith(Number.POSITIVE_INFINITY)(channels, constVoid)

/** @internal */
export const mergeAllUnboundedWith = <
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
> => mergeAllWith(Number.POSITIVE_INFINITY)(channels, f)

/** @internal */
export const mergeAllWith = (
  n: number,
  bufferSize = 16,
  mergeStrategy: MergeStrategy.MergeStrategy = _mergeStrategy.BackPressure
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
        const lastDone = yield* $(Ref.make<Option.Option<OutDone>>(Option.none))
        const errorSignal = yield* $(Deferred.make<never, void>())
        const permits = yield* $(TSemaphore.make(n))
        const pull = yield* $(toPull(channels))
        const evaluatePull = (
          pull: Effect.Effect<Env | Env1, OutErr | OutErr1, Either.Either<OutDone, OutElem>>
        ) =>
          pipe(
            pull,
            Effect.flatMap(Either.match(
              (done) => Effect.succeed(Option.some(done)),
              (outElem) => pipe(queue, Queue.offer(Effect.succeed(Either.right(outElem))), Effect.as(Option.none))
            )),
            Effect.repeatUntil(Option.isSome),
            Effect.flatMap(Option.match(
              () => Effect.unit(),
              (outDone) =>
                pipe(
                  lastDone,
                  Ref.update(Option.match(
                    () => Option.some(outDone),
                    (lastDone) => Option.some(f(lastDone, outDone))
                  ))
                )
            )),
            Effect.catchAllCause((cause) =>
              Cause.isInterrupted(cause) ?
                Effect.failCause(cause) :
                pipe(
                  queue,
                  Queue.offer(Effect.failCause(cause)),
                  Effect.zipRight(
                    pipe(
                      errorSignal,
                      Deferred.succeed<void>(void 0)
                    )
                  ),
                  Effect.asUnit
                )
            )
          )
        yield* $(
          pipe(
            pull,
            Effect.foldCauseEffect(
              (cause) =>
                pipe(
                  queue,
                  Queue.offer(Effect.failCause(cause)),
                  Effect.zipRight(Effect.succeed(false))
                ),
              Either.match(
                (outDone) =>
                  pipe(
                    Deferred.await(errorSignal),
                    Effect.raceWith(
                      pipe(permits, TSemaphore.withPermits(n))(Effect.unit()),
                      (_, permitAcquisition) => pipe(Fiber.interrupt(permitAcquisition), Effect.as(false)),
                      (_, failureAwait) =>
                        pipe(
                          Fiber.interrupt(failureAwait),
                          Effect.zipRight(
                            pipe(
                              Ref.get(lastDone),
                              Effect.flatMap(Option.match(
                                () => pipe(queue, Queue.offer(Effect.succeed(Either.left(outDone)))),
                                (lastDone) =>
                                  pipe(queue, Queue.offer(Effect.succeed(Either.left(f(lastDone, outDone)))))
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
                              latch,
                              Deferred.succeed<void>(void 0),
                              Effect.zipRight(raceEffects),
                              TSemaphore.withPermit(permits),
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
                              Effect.flatMap(Deferred.succeed<void>(void 0)),
                              Effect.when(() => size >= n)
                            )
                          )
                          yield* $(pipe(cancelers, Queue.offer(canceler)))
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
                            latch,
                            Deferred.succeed<void>(void 0),
                            Effect.zipRight(raceEffects),
                            TSemaphore.withPermit(permits),
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
          Effect.foldCause(
            core.failCause,
            Either.match(
              core.succeedNow,
              (outElem) => pipe(core.write(outElem), core.flatMap(() => consumer))
            )
          ),
          unwrap
        )
        return pipe(consumer, core.embedInput(input))
      }),
      unwrapScoped
    )
}

/** @internal */
export const mergeMap = (
  n: number,
  bufferSize = 16,
  mergeStrategy: MergeStrategy.MergeStrategy = _mergeStrategy.BackPressure
) => {
  return <OutElem, Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>(
    f: (outElem: OutElem) => Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>
  ) => {
    return <Env, InErr, InElem, InDone, OutErr, OutDone>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
    ): Channel.Channel<
      Env | Env1,
      InErr & InErr1,
      InElem & InElem1,
      InDone & InDone1,
      OutErr | OutErr1,
      OutElem1,
      unknown
    > => mergeAll(n, bufferSize, mergeStrategy)(pipe(self, mapOut(f)))
  }
}

/** @internal */
export const mergeOut = (n: number) => {
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
    OutElem1,
    OutDone,
    Z
  >(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, Z>,
      OutDone
    >
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    unknown
  > => mergeAll(n)(pipe(self, mapOut(identity)))
}

/** @internal */
export const mergeOutWith = <OutDone1>(
  n: number,
  f: (o1: OutDone1, o2: OutDone1) => OutDone1
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
    OutElem1
  >(
    self: Channel.Channel<
      Env,
      InErr,
      InElem,
      InDone,
      OutErr,
      Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
      OutDone1
    >
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem1,
    OutDone1
  > => mergeAllWith(n)(pipe(self, mapOut(identity)), f)
}

/** @internal */
export const mergeWith = <
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
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>,
  leftDone: (
    exit: Exit.Exit<OutErr, OutDone>
  ) => MergeDecision.MergeDecision<Env1, OutErr1, OutDone1, OutErr2, OutDone2>,
  rightDone: (
    ex: Exit.Exit<OutErr1, OutDone1>
  ) => MergeDecision.MergeDecision<Env1, OutErr, OutDone, OutErr3, OutDone3>
) => {
  return <Env, InErr, InElem, InDone, OutElem>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr2 | OutErr3,
    OutElem | OutElem1,
    OutDone2 | OutDone3
  > =>
    pipe(
      Effect.gen(function*($) {
        const input = yield* $(singleProducerAsyncInput.make<
          InErr & InErr1,
          InElem & InElem1,
          InDone & InDone1
        >())
        const queueReader = fromInput(input)
        const pullL = yield* $(pipe(queueReader, core.pipeTo(self), toPull))
        const pullR = yield* $(pipe(queueReader, core.pipeTo(that), toPull))

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
              if (op.op === MergeDecisionOpCodes.OP_DONE) {
                return Effect.succeed(
                  core.fromEffect(
                    pipe(
                      Fiber.interrupt(fiber),
                      Effect.zipRight(op.effect)
                    )
                  )
                )
              }
              return pipe(
                Fiber.await(fiber),
                Effect.map(Exit.match<
                  Err2,
                  Either.Either<Done2, OutElem1 | OutElem>,
                  Channel.Channel<
                    Env1 | Env,
                    unknown,
                    unknown,
                    unknown,
                    OutErr2 | OutErr3,
                    OutElem1 | OutElem,
                    OutDone2 | OutDone3
                  >
                >(
                  (cause) => core.fromEffect(op.f(Exit.failCause(cause))),
                  Either.match(
                    (done) => core.fromEffect(op.f(Exit.succeed(done))),
                    (elem) =>
                      pipe(
                        core.write(elem),
                        zipRight(go(single(op.f)))
                      )
                  )
                ))
              )
            }

            return pipe(
              exit,
              Exit.match(
                (cause) => onDecision(done(Exit.failCause(cause))),
                Either.match(
                  (z) => onDecision(done(Exit.succeed(z))),
                  (elem) =>
                    Effect.succeed(
                      pipe(
                        core.write(elem),
                        core.flatMap(() =>
                          pipe(
                            core.fromEffect(Effect.forkDaemon(pull)),
                            core.flatMap((leftFiber) => go(both(leftFiber, fiber)))
                          )
                        )
                      )
                    )
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
          switch (state.op) {
            case MergeStateOpCodes.OP_BOTH_RUNNING: {
              const leftJoin = Effect.interruptible(Fiber.join(state.left))
              const rightJoin = Effect.interruptible(Fiber.join(state.right))
              return unwrap(
                pipe(
                  leftJoin,
                  Effect.raceWith(
                    rightJoin,
                    (leftExit, rf) =>
                      pipe(
                        Fiber.interrupt(rf),
                        Effect.zipRight(
                          handleSide(leftExit, state.right, pullL)(
                            leftDone,
                            mergeState.BothRunning,
                            (f) => mergeState.LeftDone(f)
                          )
                        )
                      ),
                    (rightExit, lf) =>
                      pipe(
                        Fiber.interrupt(lf),
                        Effect.zipRight(
                          handleSide(rightExit, state.left, pullR)(
                            rightDone as (
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
                )
              )
            }
            case MergeStateOpCodes.OP_LEFT_DONE: {
              return unwrap(
                pipe(
                  Effect.exit(pullR),
                  Effect.map(Exit.match(
                    (cause) => core.fromEffect(state.f(Exit.failCause(cause))),
                    Either.match(
                      (done) => core.fromEffect(state.f(Exit.succeed(done))),
                      (elem) => pipe(core.write(elem), core.flatMap(() => go(mergeState.LeftDone(state.f))))
                    )
                  ))
                )
              )
            }
            case MergeStateOpCodes.OP_RIGHT_DONE: {
              return unwrap(
                pipe(
                  Effect.exit(pullL),
                  Effect.map(
                    Exit.match(
                      (cause) => core.fromEffect(state.f(Exit.failCause(cause))),
                      Either.match(
                        (done) => core.fromEffect(state.f(Exit.succeed(done))),
                        (elem) => pipe(core.write(elem), core.flatMap(() => go(mergeState.RightDone(state.f))))
                      )
                    )
                  )
                )
              )
            }
          }
        }

        return pipe(
          core.fromEffect(
            pipe(
              Effect.forkDaemon(pullL),
              Effect.zipWith(
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
            )
          ),
          core.flatMap(go),
          core.embedInput(input)
        )
      }),
      unwrapScoped
    )
}

/** @internal */
export const never = (): Channel.Channel<never, unknown, unknown, unknown, never, never, never> =>
  core.fromEffect(Effect.never())

/** @internal */
export const orDie = <E>(error: LazyArg<E>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> => pipe(self, orDieWith(error))
}

/** @internal */
export const orDieWith = <OutErr>(f: (e: OutErr) => unknown) => {
  return <Env, InErr, InElem, InDone, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone> =>
    pipe(
      self,
      catchAll((e) => {
        throw f(e)
      })
    ) as Channel.Channel<Env, InErr, InElem, InDone, never, OutElem, OutDone>
}

/** @internal */
export const orElse = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: LazyArg<Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr1,
    OutElem | OutElem1,
    OutDone | OutDone1
  > => pipe(self, catchAll(that))
}

/** @internal */
export const pipeToOrFail = <
  Env2,
  OutElem,
  OutDone,
  OutErr2,
  OutElem2,
  OutDone2
>(
  that: Channel.Channel<Env2, never, OutElem, OutDone, OutErr2, OutElem2, OutDone2>
) => {
  return <Env, InErr, InElem, InDone, OutErr>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | Env2, InErr, InElem, InDone, OutErr | OutErr2, OutElem2, OutDone2> =>
    core.suspend(() => {
      let channelException: Channel.ChannelException<OutErr | OutErr2> | undefined = undefined

      const reader: Channel.Channel<Env, OutErr, OutElem, OutDone, never, OutElem, OutDone> = core
        .readWith(
          (outElem) => pipe(core.write(outElem), core.flatMap(() => reader)),
          (outErr) => {
            channelException = ChannelException(outErr)
            return pipe(core.failCause(Cause.die(channelException)))
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
        (cause) =>
          Cause.isDieType(cause) &&
            isChannelException(cause.defect) &&
            Equal.equals(cause.defect, channelException)
            ? core.fail(cause.defect.error as OutErr2)
            : core.failCause(cause),
        core.succeedNow
      )

      return pipe(self, core.pipeTo(reader), core.pipeTo(that), core.pipeTo(writer))
    })
}

/** @internal */
export const provideService = <T>(tag: Context.Tag<T>) =>
  <T1 extends T>(service: T1) =>
    <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
      self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
    ): Channel.Channel<Exclude<Env, T>, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
      return pipe(
        environment<any>(),
        core.flatMap((context) =>
          pipe(
            self,
            core.provideEnvironment(
              pipe(context, Context.add(tag)(service))
            )
          )
        )
      )
    }

/** @internal */
export const provideLayer = <Env0, Env, OutErr2>(layer: Layer.Layer<Env0, OutErr2, Env>) => {
  return <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env0, InErr, InElem, InDone, OutErr | OutErr2, OutElem, OutDone> =>
    unwrapScoped(pipe(Layer.build(layer), Effect.map((env) => pipe(self, core.provideEnvironment(env)))))
}

/** @internal */
export const provideSomeEnvironment = <Env0, Env>(f: (env: Context.Context<Env0>) => Context.Context<Env>) => {
  return <InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env0, InErr, InElem, InDone, OutErr, OutElem, OutDone> =>
    environmentWithChannel((context: Context.Context<Env0>) => pipe(self, core.provideEnvironment(f(context))))
}

/** @internal */
export const provideSomeLayer = <Env0, Env2, OutErr2>(layer: Layer.Layer<Env0, OutErr2, Env2>) => {
  return <R, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<R, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env0 | Exclude<R, Env2>, InErr, InElem, InDone, OutErr | OutErr2, OutElem, OutDone> =>
    pipe(
      self,
      // @ts-expect-error
      provideLayer(pipe(Layer.environment<Exclude<R, Env2>>(), Layer.merge(layer)))
    )
}

/** @internal */
export const read = <In>(): Channel.Channel<
  never,
  unknown,
  In,
  unknown,
  Option.Option<never>,
  never,
  In
> => core.readOrFail(Option.none)

/** @internal */
export const repeated = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
  return pipe(self, core.flatMap(() => repeated(self)))
}

/** @internal */
export const run = <Env, InErr, InDone, OutErr, OutDone>(
  self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, never, OutDone>
): Effect.Effect<Env, OutErr, OutDone> => {
  const trace = getCallTrace()
  return Effect.scoped(executor.runScoped(self)).traced(trace)
}

/** @internal */
export const runCollect = <Env, InErr, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
): Effect.Effect<Env, OutErr, readonly [Chunk.Chunk<OutElem>, OutDone]> => {
  const trace = getCallTrace()
  return executor.run(core.collectElements(self)).traced(trace)
}

/** @internal */
export const runDrain = <Env, InErr, InDone, OutElem, OutErr, OutDone>(
  self: Channel.Channel<Env, InErr, unknown, InDone, OutErr, OutElem, OutDone>
): Effect.Effect<Env, OutErr, OutDone> => {
  const trace = getCallTrace()
  return executor.run(drain(self)).traced(trace)
}

/** @internal */
export const scoped = <R, E, A>(
  effect: Effect.Effect<R | Scope.Scope, E, A>
): Channel.Channel<Exclude<R | Scope.Scope, Scope.Scope>, unknown, unknown, unknown, E, A, unknown> => {
  return pipe(
    Effect.uninterruptibleMask((restore) =>
      pipe(
        Scope.make(),
        Effect.map((scope) =>
          core.acquireReleaseOut(
            pipe(
              restore(pipe(scope, Scope.extend(effect))),
              Effect.tapErrorCause((cause) =>
                pipe(
                  scope,
                  Scope.close(Exit.failCause(cause))
                )
              )
            ),
            (_, exit) => pipe(scope, Scope.close(exit))
          )
        )
      )
    ),
    unwrap
  )
}

/** @internal */
export const service = <T>(tag: Context.Tag<T>): Channel.Channel<T, unknown, unknown, unknown, never, never, T> => {
  return core.fromEffect(Effect.service(tag))
}

/** @internal */
export const serviceWith = <T>(tag: Context.Tag<T>) => {
  return <OutDone>(
    f: (resource: T) => OutDone
  ): Channel.Channel<T, unknown, unknown, unknown, never, never, OutDone> => {
    return pipe(service(tag), map(f))
  }
}

/** @internal */
export const serviceWithChannel = <T>(tag: Context.Tag<T>) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    f: (resource: T) => Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<Env | T, InErr, InElem, InDone, OutErr, OutElem, OutDone> => {
    return pipe(service(tag), core.flatMap(f))
  }
}

/** @internal */
export const serviceWithEffect = <T>(tag: Context.Tag<T>) => {
  return <Env, OutErr, OutDone>(
    f: (resource: T) => Effect.Effect<Env, OutErr, OutDone>
  ): Channel.Channel<Env | T, unknown, unknown, unknown, OutErr, never, OutDone> => {
    return pipe(service(tag), mapEffect(f))
  }
}

/** @internal */
export const toHub = <Err, Done, Elem>(
  hub: Hub.Hub<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, Err, Elem, Done, never, never, unknown> => {
  return toQueue(hub)
}

/** @internal */
export const toPull = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Effect.Effect<Env | Scope.Scope, never, Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>>> => {
  return pipe(
    Effect.acquireRelease(
      Effect.sync(() => new executor.ChannelExecutor(self, void 0, identity)),
      (exec, exit) => {
        const finalize = exec.close(exit)
        return finalize === undefined ? Effect.unit() : finalize
      }
    ),
    Effect.map((exec) =>
      Effect.suspendSucceed(() => interpretToPull(exec.run() as ChannelState.ChannelState<Env, OutErr>, exec))
    )
  )
}

/** @internal */
const interpretToPull = <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  channelState: ChannelState.ChannelState<Env, OutErr>,
  exec: executor.ChannelExecutor<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
): Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>> => {
  const state = channelState as ChannelState.Primitive
  switch (state.op) {
    case ChannelStateOpCodes.OP_DONE: {
      return pipe(
        exec.getDone(),
        Exit.match(
          Effect.failCause,
          (done): Effect.Effect<Env, OutErr, Either.Either<OutDone, OutElem>> => Effect.succeed(Either.left(done))
        )
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
export const toQueue = <Err, Done, Elem>(
  queue: Queue.Enqueue<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, Err, Elem, Done, never, never, unknown> => {
  return core.suspend(() => toQueueInternal(queue))
}

/** @internal */
const toQueueInternal = <Err, Done, Elem>(
  queue: Queue.Enqueue<Either.Either<Exit.Exit<Err, Done>, Elem>>
): Channel.Channel<never, Err, Elem, Done, never, never, unknown> => {
  return core.readWithCause(
    (elem) =>
      pipe(
        core.fromEffect(pipe(queue, Queue.offer(Either.right(elem)))),
        core.flatMap(() => toQueueInternal(queue))
      ),
    (cause) => core.fromEffect(pipe(queue, Queue.offer(Either.left(Exit.failCause(cause))))),
    (done) => core.fromEffect(pipe(queue, Queue.offer(Either.left(Exit.succeed(done)))))
  )
}

/** @internal */
export const unwrap = <R, E, R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
  channel: Effect.Effect<R, E, Channel.Channel<R2, InErr, InElem, InDone, OutErr, OutElem, OutDone>>
): Channel.Channel<R | R2, InErr, InElem, InDone, E | OutErr, OutElem, OutDone> => {
  return flatten(core.fromEffect(channel))
}

/** @internal */
export const unwrapScoped = <
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
> => {
  return core.concatAllWith(
    scoped(self),
    (d, _) => d,
    (d, _) => d
  )
}

/** @internal */
export const updateService = <T>(tag: Context.Tag<T>) => {
  return (<T1 extends T>(f: (resource: T) => T1) => {
    return <R, InErr, InDone, OutElem, OutErr, OutDone>(
      self: Channel.Channel<R, InErr, unknown, InDone, OutErr, OutElem, OutDone>
    ): Channel.Channel<R | T, InErr, unknown, InDone, OutErr, OutElem, OutDone> =>
      pipe(
        self,
        provideSomeEnvironment((context) =>
          pipe(
            context,
            Context.merge(pipe(Context.empty(), Context.add(tag)(f(pipe(context, Context.unsafeGet(tag))))))
          )
        )
      )
  })
}

/** @internal */
export const writeAll = <OutElem>(
  ...outs: Array<OutElem>
): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> => {
  return writeChunk(Chunk.fromIterable(outs))
}

/** @internal */
export const writeChunk = <OutElem>(
  outs: Chunk.Chunk<OutElem>
): Channel.Channel<never, unknown, unknown, unknown, never, OutElem, void> => {
  return writeChunkWriter(0, outs.length, outs)
}

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
export const zip = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    readonly [OutDone, OutDone1]
  > => pipe(self, core.flatMap((a) => pipe(that, map((b) => [a, b] as const))))
}

/** @internal */
export const zipLeft = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone
  > => pipe(self, core.flatMap((z) => pipe(that, as(z))))
}

/** @internal */
export const zipRight = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env | Env1,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone1
  > => pipe(self, core.flatMap(() => that))
}

/** @internal */
export const zipPar = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    readonly [OutDone, OutDone1]
  > =>
    pipe(
      self,
      mergeWith(
        that,
        (exit1) => mergeDecision.Await((exit2) => Effect.done(pipe(exit1, Exit.zip(exit2)))),
        (exit2) => mergeDecision.Await((exit1) => Effect.done(pipe(exit1, Exit.zip(exit2))))
      )
    )
}

/** @internal */
export const zipParLeft = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone
  > => pipe(self, zipPar(that), map((tuple) => tuple[0]))
}

/** @internal */
export const zipParRight = <Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>(
  that: Channel.Channel<Env1, InErr1, InElem1, InDone1, OutErr1, OutElem1, OutDone1>
) => {
  return <Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>(
    self: Channel.Channel<Env, InErr, InElem, InDone, OutErr, OutElem, OutDone>
  ): Channel.Channel<
    Env1 | Env,
    InErr & InErr1,
    InElem & InElem1,
    InDone & InDone1,
    OutErr | OutErr1,
    OutElem | OutElem1,
    OutDone1
  > => pipe(self, zipPar(that), map((tuple) => tuple[1]))
}

/** @internal */
export const ChannelExceptionTypeId: Channel.ChannelExceptionTypeId = Symbol.for(
  "@effect/stream/Channel/errors/ChannelException"
) as Channel.ChannelExceptionTypeId

/** @internal */
export const ChannelException = <E>(error: E): Channel.ChannelException<E> => ({
  [ChannelExceptionTypeId]: ChannelExceptionTypeId,
  error
})

/** @internal */
export const isChannelException = (u: unknown): u is Channel.ChannelException<unknown> => {
  return typeof u === "object" && u != null && ChannelExceptionTypeId in u
}
