import * as Cause from "@effect/io/Cause"
import * as Clock from "@effect/io/Clock"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Hub from "@effect/io/Hub"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import type * as Scope from "@effect/io/Scope"
import type * as Channel from "@effect/stream/Channel"
import type * as MergeDecision from "@effect/stream/Channel/MergeDecision"
import * as channel from "@effect/stream/internal/channel"
import * as mergeDecision from "@effect/stream/internal/channel/mergeDecision"
import * as core from "@effect/stream/internal/core"
import type * as Sink from "@effect/stream/Sink"
import * as Chunk from "@fp-ts/data/Chunk"
import type * as Context from "@fp-ts/data/Context"
import * as Duration from "@fp-ts/data/Duration"
import * as Either from "@fp-ts/data/Either"
import type { LazyArg } from "@fp-ts/data/Function"
import { constTrue, identity, pipe } from "@fp-ts/data/Function"
import * as HashMap from "@fp-ts/data/HashMap"
import * as HashSet from "@fp-ts/data/HashSet"
import * as Option from "@fp-ts/data/Option"
import type { Predicate, Refinement } from "@fp-ts/data/Predicate"
import * as ReadonlyArray from "@fp-ts/data/ReadonlyArray"

/** @internal */
const SinkSymbolKey = "@effect/stream/Sink"

/** @internal */
export const SinkTypeId: Sink.SinkTypeId = Symbol.for(
  SinkSymbolKey
) as Sink.SinkTypeId

/** @internal */
const sinkVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _In: (_: unknown) => _,
  _L: (_: never) => _,
  _Z: (_: never) => _
}

/** @internal */
export class SinkImpl<R, E, In, L, Z> implements Sink.Sink<R, E, In, L, Z> {
  readonly [SinkTypeId] = sinkVariance
  constructor(
    readonly channel: Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<L>, Z>
  ) {}
}

/** @internal */
export const as = <Z2>(z: Z2) => {
  return <R, E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, L, Z2> => pipe(self, map(() => z))
}

/** @internal */
export const collectAll = <In>(): Sink.Sink<never, never, In, never, Chunk.Chunk<In>> =>
  new SinkImpl(collectAllLoop(Chunk.empty()))

/** @internal */
const collectAllLoop = <In>(
  acc: Chunk.Chunk<In>
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, never, Chunk.Chunk<In>> =>
  core.readWithCause(
    (chunk: Chunk.Chunk<In>) => collectAllLoop(pipe(acc, Chunk.concat(chunk))),
    core.failCause,
    () => core.succeed(acc)
  )

/** @internal */
export const collectAllN = <In>(n: number): Sink.Sink<never, never, In, In, Chunk.Chunk<In>> => {
  return pipe(
    fromEffect(Effect.sync(() => Chunk.empty<In>())),
    flatMap((builder) => foldUntil<Chunk.Chunk<In>, In>(builder, n, (chunk, input) => pipe(chunk, Chunk.append(input))))
  )
}

/** @internal */
export const collectAllFrom = <R, E, In, L extends In, Z>(
  self: Sink.Sink<R, E, In, L, Z>
): Sink.Sink<R, E, In, L, Chunk.Chunk<Z>> =>
  pipe(self, collectAllWhileWith(Chunk.empty<Z>(), constTrue, (chunk, z) => pipe(chunk, Chunk.append(z))))

/** @internal */
export const collectAllToMap = <In, K>(
  key: (input: In) => K,
  merge: (x: In, y: In) => In
): Sink.Sink<never, never, In, never, HashMap.HashMap<K, In>> => {
  return pipe(
    foldLeftChunks(HashMap.empty<K, In>(), (map, chunk) =>
      pipe(
        chunk,
        Chunk.reduce(map, (map, input) => {
          const k: K = key(input)
          const v: In = pipe(map, HashMap.has(k)) ?
            merge(pipe(map, HashMap.unsafeGet(k)), input) :
            input
          return pipe(map, HashMap.set(k, v))
        })
      ))
  )
}

/** @internal */
export const collectAllToMapN = <In, K>(
  n: number,
  key: (input: In) => K,
  merge: (x: In, y: In) => In
): Sink.Sink<never, never, In, In, HashMap.HashMap<K, In>> => {
  return foldWeighted<HashMap.HashMap<K, In>, In>(
    HashMap.empty(),
    n,
    (acc, input) => pipe(acc, HashMap.has(key(input))) ? 0 : 1,
    (acc, input) => {
      const k: K = key(input)
      const v: In = pipe(acc, HashMap.has(k)) ?
        merge(pipe(acc, HashMap.unsafeGet(k)), input) :
        input
      return pipe(acc, HashMap.set(k, v))
    }
  )
}

/** @internal */
export const collectAllToSet = <In>(): Sink.Sink<never, never, In, never, HashSet.HashSet<In>> =>
  foldLeftChunks<HashSet.HashSet<In>, In>(
    HashSet.empty(),
    (acc, chunk) => pipe(chunk, Chunk.reduce(acc, (acc, input) => pipe(acc, HashSet.add(input))))
  )

/** @internal */
export const collectAllToSetN = <In>(n: number): Sink.Sink<never, never, In, In, HashSet.HashSet<In>> =>
  foldWeighted<HashSet.HashSet<In>, In>(
    HashSet.empty(),
    n,
    (acc, input) => pipe(acc, HashSet.has(input)) ? 0 : 1,
    (acc, input) => pipe(acc, HashSet.add(input))
  )

/** @internal */
export const collectAllUntil = <In>(p: Predicate<In>): Sink.Sink<never, never, In, In, Chunk.Chunk<In>> => {
  return pipe(
    fold<readonly [Chunk.Chunk<In>, boolean], In>(
      [Chunk.empty(), true],
      (tuple) => tuple[1],
      ([chunk, _], input) => [pipe(chunk, Chunk.append(input)), !p(input)] as const
    ),
    map((tuple) => tuple[0])
  )
}

/** @internal */
export const collectAllUntilEffect = <In, R, E>(p: (input: In) => Effect.Effect<R, E, boolean>) => {
  return pipe(
    foldEffect<readonly [Chunk.Chunk<In>, boolean], R, E, In>(
      [Chunk.empty(), true],
      (tuple) => tuple[1],
      ([chunk, _], input) => pipe(p(input), Effect.map((bool) => [pipe(chunk, Chunk.append(input)), !bool]))
    ),
    map((tuple) => tuple[0])
  )
}

/** @internal */
export const collectAllWhile = <In>(predicate: Predicate<In>): Sink.Sink<never, never, In, In, Chunk.Chunk<In>> =>
  fromChannel(collectAllWhileReader(predicate, Chunk.empty()))

/** @internal */
const collectAllWhileReader = <In>(
  predicate: Predicate<In>,
  done: Chunk.Chunk<In>
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, Chunk.Chunk<In>> =>
  core.readWith(
    (input: Chunk.Chunk<In>) => {
      const [collected, leftovers] = pipe(Chunk.toReadonlyArray(input), ReadonlyArray.span(predicate))
      if (leftovers.length === 0) {
        return collectAllWhileReader(
          predicate,
          pipe(done, Chunk.concat(Chunk.unsafeFromArray(collected)))
        )
      }
      return pipe(
        core.write(Chunk.unsafeFromArray(leftovers)),
        channel.zipRight(core.succeed(pipe(done, Chunk.concat(Chunk.unsafeFromArray(collected)))))
      )
    },
    core.fail,
    () => core.succeed(done)
  )

/** @internal */
export const collectAllWhileEffect = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>
): Sink.Sink<R, E, In, In, Chunk.Chunk<In>> => fromChannel(collectAllWhileEffectReader(predicate, Chunk.empty()))

/** @internal */
const collectAllWhileEffectReader = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>,
  done: Chunk.Chunk<In>
): Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, Chunk.Chunk<In>> =>
  core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(pipe(input, Effect.takeWhile(predicate))),
        core.flatMap((collected) => {
          const leftovers = pipe(input, Chunk.drop(collected.length))
          if (Chunk.isEmpty(leftovers)) {
            return collectAllWhileEffectReader(predicate, pipe(done, Chunk.concat(collected)))
          }
          return pipe(core.write(leftovers), channel.zipRight(core.succeed(pipe(done, Chunk.concat(collected)))))
        })
      ),
    core.fail,
    () => core.succeed(done)
  )

/** @internal */
export const collectAllWhileWith = <Z, S>(z: S, p: Predicate<Z>, f: (s: S, z: Z) => S) => {
  return <R, E, In, L extends In>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, L, S> => {
    const refs = pipe(
      Ref.make(Chunk.empty<In>()),
      Effect.zip(Ref.make(false))
    )
    const newChannel = pipe(
      core.fromEffect(refs),
      core.flatMap(([leftoversRef, upstreamDoneRef]) => {
        const upstreamMarker: Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, unknown> =
          core.readWith(
            (input) => pipe(core.write(input), core.flatMap(() => upstreamMarker)),
            core.fail,
            (done) => pipe(core.fromEffect(pipe(upstreamDoneRef, Ref.set(true))), channel.as(done))
          )
        return pipe(
          upstreamMarker,
          core.pipeTo(channel.bufferChunk(leftoversRef)),
          core.pipeTo(collectAllWhileWithLoop(self, leftoversRef, upstreamDoneRef, z, p, f))
        )
      })
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
const collectAllWhileWithLoop = <R, E, In, L extends In, Z, S>(
  self: Sink.Sink<R, E, In, L, Z>,
  leftoversRef: Ref.Ref<Chunk.Chunk<In>>,
  upstreamDoneRef: Ref.Ref<boolean>,
  currentResult: S,
  p: Predicate<Z>,
  f: (s: S, z: Z) => S
): Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<L>, S> => {
  return pipe(
    self.channel,
    channel.doneCollect,
    channel.foldChannel(
      core.fail,
      ([leftovers, doneValue]) =>
        p(doneValue)
          ? pipe(
            core.fromEffect(pipe(
              leftoversRef,
              Ref.set(Chunk.flatten(leftovers as Chunk.Chunk<Chunk.Chunk<In>>))
            )),
            core.flatMap(() =>
              pipe(
                core.fromEffect(Ref.get(upstreamDoneRef)),
                core.flatMap((upstreamDone) => {
                  const accumulatedResult = f(currentResult, doneValue)
                  return upstreamDone
                    ? pipe(core.write(Chunk.flatten(leftovers)), channel.as(accumulatedResult))
                    : collectAllWhileWithLoop(self, leftoversRef, upstreamDoneRef, accumulatedResult, p, f)
                })
              )
            )
          )
          : pipe(core.write(Chunk.flatten(leftovers)), channel.as(currentResult))
    )
  )
}

/** @internal */
export const collectLeftover = <R, E, In, L, Z>(
  self: Sink.Sink<R, E, In, L, Z>
): Sink.Sink<R, E, In, never, readonly [Z, Chunk.Chunk<L>]> =>
  new SinkImpl(pipe(core.collectElements(self.channel), channel.map(([chunks, z]) => [z, Chunk.flatten(chunks)])))

/** @internal */
export const contramap = <In0, In>(f: (input: In0) => In) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In0, L, Z> =>
    pipe(self, contramapChunks(Chunk.map(f)))
}

/** @internal */
export const contramapEffect = <In0, R2, E2, In>(f: (input: In0) => Effect.Effect<R2, E2, In>) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In0, L, Z> =>
    pipe(self, contramapChunksEffect(Effect.forEach(f)))
}

/** @internal */
export const contramapChunks = <In0, In>(f: (chunk: Chunk.Chunk<In0>) => Chunk.Chunk<In>) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In0, L, Z> => {
    const loop: Channel.Channel<R, never, Chunk.Chunk<In0>, unknown, never, Chunk.Chunk<In>, unknown> = core.readWith(
      (chunk) => pipe(core.write(f(chunk)), core.flatMap(() => loop)),
      core.fail,
      core.succeed
    )
    return new SinkImpl(pipe(loop, core.pipeTo(self.channel)))
  }
}

/** @internal */
export const contramapChunksEffect = <In0, R2, E2, In>(
  f: (chunk: Chunk.Chunk<In0>) => Effect.Effect<R2, E2, Chunk.Chunk<In>>
) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In0, L, Z> => {
    const loop: Channel.Channel<R | R2, never, Chunk.Chunk<In0>, unknown, E2, Chunk.Chunk<In>, unknown> = core
      .readWith(
        (chunk) => pipe(core.fromEffect(f(chunk)), core.flatMap(core.write), core.flatMap(() => loop)),
        core.fail,
        core.succeed
      )
    return new SinkImpl(pipe(loop, channel.pipeToOrFail(self.channel)))
  }
}

/** @internal */
export const count = (): Sink.Sink<never, never, unknown, never, number> => foldLeft(0, (s, _) => s + 1)

/** @internal */
export const die = (defect: unknown): Sink.Sink<never, never, unknown, never, never> => failCause(Cause.die(defect))

/** @internal */
export const dieMessage = (message: string): Sink.Sink<never, never, unknown, never, never> =>
  failCause(Cause.die(Cause.RuntimeException(message)))

/** @internal */
export const dieSync = (evaluate: LazyArg<unknown>): Sink.Sink<never, never, unknown, never, never> =>
  failCauseSync(() => Cause.die(evaluate()))

/** @internal */
export const dimap = <In0, In, Z, Z2>(
  f: (input: In0) => In,
  g: (z: Z) => Z2
) => {
  return <R, E, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In0, L, Z2> => pipe(self, contramap(f), map(g))
}

/** @internal */
export const dimapEffect = <In0, R2, E2, In, Z, R3, E3, Z2>(
  f: (input: In0) => Effect.Effect<R2, E2, In>,
  g: (z: Z) => Effect.Effect<R3, E3, Z2>
) => {
  return <R, E, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2 | R3, E | E2 | E3, In0, L, Z2> =>
    pipe(self, contramapEffect(f), mapEffect(g))
}

/** @internal */
export const dimapChunks = <In0, In, Z, Z2>(
  f: (chunk: Chunk.Chunk<In0>) => Chunk.Chunk<In>,
  g: (z: Z) => Z2
) => {
  return <R, E, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In0, L, Z2> =>
    pipe(self, contramapChunks(f), map(g))
}

/** @internal */
export const dimapChunksEffect = <In0, R2, E2, In, Z, R3, E3, Z2>(
  f: (chunk: Chunk.Chunk<In0>) => Effect.Effect<R2, E2, Chunk.Chunk<In>>,
  g: (z: Z) => Effect.Effect<R3, E3, Z2>
) => {
  return <R, E, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2 | R3, E | E2 | E3, In0, L, Z2> =>
    pipe(self, contramapChunksEffect(f), mapEffect(g))
}

/** @internal */
export const drain = (): Sink.Sink<never, never, unknown, never, void> =>
  new SinkImpl(channel.drain(channel.identityChannel<never, unknown, unknown>()))

/** @internal */
export const drop = <In>(n: number): Sink.Sink<never, never, In, In, unknown> =>
  suspend(() => new SinkImpl(dropLoop(n)))

/** @internal */
const dropLoop = <In>(
  n: number
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, unknown> =>
  core.readWith(
    (input: Chunk.Chunk<In>) => {
      const dropped = pipe(input, Chunk.drop(n))
      const leftover = Math.max(n - input.length, 0)
      const more = Chunk.isEmpty(input) || leftover > 0
      if (more) {
        return dropLoop(leftover)
      }
      return pipe(
        core.write(dropped),
        channel.zipRight(channel.identityChannel<never, Chunk.Chunk<In>, unknown>())
      )
    },
    core.fail,
    core.unit
  )

/** @internal */
export const dropUntil = <In>(predicate: Predicate<In>): Sink.Sink<never, never, In, In, unknown> =>
  new SinkImpl(pipe(dropWhile((input: In) => !predicate(input)).channel, channel.pipeToOrFail(drop<In>(1).channel)))

/** @internal */
export const dropUntilEffect = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>
): Sink.Sink<R, E, In, In, unknown> => suspend(() => new SinkImpl(dropUntilEffectReader(predicate)))

/** @internal */
const dropUntilEffectReader = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>
): Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, unknown> =>
  core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        input,
        Effect.dropUntil(predicate),
        Effect.map((leftover) => {
          const more = Chunk.isEmpty(leftover)
          return more ?
            dropUntilEffectReader(predicate) :
            pipe(core.write(leftover), channel.zipRight(channel.identityChannel<E, Chunk.Chunk<In>, unknown>()))
        }),
        channel.unwrap
      ),
    core.fail,
    core.unit
  )

/** @internal */
export const dropWhile = <In>(predicate: Predicate<In>): Sink.Sink<never, never, In, In, unknown> =>
  new SinkImpl(dropWhileReader(predicate))

/** @internal */
const dropWhileReader = <In>(
  predicate: Predicate<In>
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, unknown> =>
  core.readWith(
    (input: Chunk.Chunk<In>) => {
      const out = pipe(input, Chunk.dropWhile(predicate))
      if (Chunk.isEmpty(out)) {
        return dropWhileReader(predicate)
      }
      return pipe(core.write(out), channel.zipRight(channel.identityChannel<never, Chunk.Chunk<In>, unknown>()))
    },
    core.fail,
    core.succeedNow
  )

/** @internal */
export const dropWhileEffect = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>
): Sink.Sink<R, E, In, In, unknown> => suspend(() => new SinkImpl(dropWhileEffectReader(predicate)))

/** @internal */
const dropWhileEffectReader = <In, R, E>(
  predicate: (input: In) => Effect.Effect<R, E, boolean>
): Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, unknown> =>
  core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        input,
        Effect.dropWhile(predicate),
        Effect.map((leftover) => {
          const more = Chunk.isEmpty(leftover)
          return more ?
            dropWhileEffectReader(predicate) :
            pipe(
              core.write(leftover),
              channel.zipRight(channel.identityChannel<E, Chunk.Chunk<In>, unknown>())
            )
        }),
        channel.unwrap
      ),
    core.fail,
    core.unit
  )

/** @internal */
export const ensuring = <R2, _>(finalizer: Effect.Effect<R2, never, _>) => {
  return <R, E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E, In, L, Z> =>
    new SinkImpl(pipe(self.channel, channel.ensuring(finalizer)))
}

/** @internal */
export const ensuringWith = <E, Z, R2, _>(finalizer: (exit: Exit.Exit<E, Z>) => Effect.Effect<R2, never, _>) => {
  return <R, In, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E, In, L, Z> =>
    new SinkImpl(pipe(self.channel, core.ensuringWith(finalizer)))
}

/** @internal */
export const environment = <R>(): Sink.Sink<R, never, unknown, never, Context.Context<R>> =>
  fromEffect(Effect.environment<R>())

/** @internal */
export const environmentWith = <R, Z>(
  f: (environment: Context.Context<R>) => Z
): Sink.Sink<R, never, unknown, never, Z> => pipe(environment<R>(), map(f))

/** @internal */
export const environmentWithEffect = <R0, R, E, Z>(
  f: (environment: Context.Context<R0>) => Effect.Effect<R, E, Z>
): Sink.Sink<R0 | R, E, unknown, never, Z> => pipe(environment<R0>(), mapEffect(f))

/** @internal */
export const environmentWithSink = <R0, R, E, In, L, Z>(
  f: (environment: Context.Context<R0>) => Sink.Sink<R, E, In, L, Z>
): Sink.Sink<R0 | R, E, In, L, Z> =>
  new SinkImpl(channel.unwrap(pipe(Effect.environmentWith((context) => f(context).channel))))

/** @internal */
export const every = <In>(predicate: Predicate<In>): Sink.Sink<never, never, In, In, boolean> =>
  fold(true, identity, (acc, input) => acc && predicate(input))

/** @internal */
export const fail = <E>(e: E): Sink.Sink<never, E, unknown, never, never> => new SinkImpl(core.fail(e))

/** @internal */
export const failSync = <E>(evaluate: LazyArg<E>): Sink.Sink<never, E, unknown, never, never> =>
  new SinkImpl(core.failSync(evaluate))

/** @internal */
export const failCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, E, unknown, never, never> =>
  new SinkImpl(core.failCause(cause))

/** @internal */
export const failCauseSync = <E>(evaluate: LazyArg<Cause.Cause<E>>): Sink.Sink<never, E, unknown, never, never> =>
  new SinkImpl(core.failCauseSync(evaluate))

/** @internal */
export const filterInput: {
  <In, In1 extends In, In2 extends In1>(
    f: Refinement<In1, In2>
  ): <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>) => Sink.Sink<R, E, In2, L, Z>
  <In, In1 extends In>(f: Predicate<In1>): <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>) => Sink.Sink<R, E, In1, L, Z>
} = <In, In1 extends In>(f: Predicate<In1>) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In1, L, Z> =>
    pipe(self, contramapChunks(Chunk.filter(f)))
}

/** @internal */
export const filterInputEffect = <R2, E2, In, In1 extends In>(
  f: (input: In1) => Effect.Effect<R2, E2, boolean>
) => {
  return <R, E, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In1, L, Z> =>
    pipe(self, contramapChunksEffect(Effect.filter(f)))
}

/** @internal */
export const findEffect = <Z, R2, E2>(f: (z: Z) => Effect.Effect<R2, E2, boolean>) => {
  return <R, E, In, L extends In>(
    self: Sink.Sink<R, E, In, L, Z>
  ): Sink.Sink<R | R2, E | E2, In, L, Option.Option<Z>> => {
    const newChannel = pipe(
      core.fromEffect(pipe(
        Ref.make(Chunk.empty<In>()),
        Effect.zip(Ref.make(false))
      )),
      core.flatMap(([leftoversRef, upstreamDoneRef]) => {
        const upstreamMarker: Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, unknown> =
          core.readWith(
            (input) => pipe(core.write(input), core.flatMap(() => upstreamMarker)),
            core.fail,
            (done) => pipe(core.fromEffect(pipe(upstreamDoneRef, Ref.set(true))), channel.as(done))
          )
        const loop: Channel.Channel<R | R2, never, Chunk.Chunk<In>, unknown, E | E2, Chunk.Chunk<L>, Option.Option<Z>> =
          pipe(
            core.collectElements(self.channel),
            channel.foldChannel(
              core.fail,
              ([leftovers, doneValue]) =>
                pipe(
                  core.fromEffect(f(doneValue)),
                  core.flatMap((satisfied) =>
                    pipe(
                      core.fromEffect(pipe(leftoversRef, Ref.set(Chunk.flatten(leftovers) as Chunk.Chunk<In>))),
                      channel.zipRight(
                        pipe(
                          core.fromEffect(Ref.get(upstreamDoneRef)),
                          core.flatMap((upstreamDone) => {
                            if (satisfied) {
                              return pipe(core.write(Chunk.flatten(leftovers)), channel.as(Option.some(doneValue)))
                            }
                            if (upstreamDone) {
                              return pipe(core.write(Chunk.flatten(leftovers)), channel.as(Option.none))
                            }
                            return loop
                          })
                        )
                      )
                    )
                  )
                )
            )
          )
        return pipe(upstreamMarker, core.pipeTo(channel.bufferChunk(leftoversRef)), core.pipeTo(loop))
      })
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
export const fold = <S, In>(
  s: S,
  contFn: Predicate<S>,
  f: (z: S, input: In) => S
): Sink.Sink<never, never, In, In, S> => suspend(() => new SinkImpl(foldReader(s, contFn, f)))

// def fold[In, S](
//   z: => S
// )(contFn: S => Boolean)(f: (S, In) => S)(implicit trace: Trace): ZSink[Any, Nothing, In, In, S] =
//   ZSink.suspend {
//     def foldChunkSplit(z: S, chunk: Chunk[In])(
//       contFn: S => Boolean
//     )(f: (S, In) => S): (S, Chunk[In]) = {
//       def fold(s: S, chunk: Chunk[In], idx: Int, len: Int): (S, Chunk[In]) =
//         if (idx == len) {
//           (s, Chunk.empty)
//         } else {
//           val s1 = f(s, chunk(idx))
//           if (contFn(s1)) {
//             fold(s1, chunk, idx + 1, len)
//           } else {
//             (s1, chunk.drop(idx + 1))
//           }
//         }

//       fold(z, chunk, 0, chunk.length)
//     }

//     def reader(s: S): ZChannel[Any, ZNothing, Chunk[In], Any, Nothing, Chunk[In], S] =
//       if (!contFn(s)) ZChannel.succeedNow(s)
//       else
//         ZChannel.readWith(
//           (in: Chunk[In]) => {
//             val (nextS, leftovers) = foldChunkSplit(s, in)(contFn)(f)

//             if (leftovers.nonEmpty) ZChannel.write(leftovers).as(nextS)
//             else reader(nextS)
//           },
//           (err: ZNothing) => ZChannel.fail(err),
//           (x: Any) => ZChannel.succeedNow(s)
//         )

//     new ZSink(reader(z))
//   }

/** @internal */
const foldReader = <S, In>(
  s: S,
  contFn: Predicate<S>,
  f: (z: S, input: In) => S
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, S> => {
  if (!contFn(s)) {
    return core.succeedNow(s)
  }
  return core.readWith(
    (input: Chunk.Chunk<In>) => {
      const [nextS, leftovers] = foldChunkSplit(s, input, contFn, f, 0, input.length)
      if (Chunk.isNonEmpty(leftovers)) {
        return pipe(core.write(leftovers), channel.as(nextS))
      }
      return foldReader(nextS, contFn, f)
    },
    core.fail,
    () => core.succeedNow(s)
  )
}

/** @internal */
const foldChunkSplit = <S, In>(
  s: S,
  chunk: Chunk.Chunk<In>,
  contFn: Predicate<S>,
  f: (z: S, input: In) => S,
  index: number,
  length: number
): readonly [S, Chunk.Chunk<In>] => {
  if (index === length) {
    return [s, Chunk.empty()]
  }
  const s1 = f(s, pipe(chunk, Chunk.unsafeGet(index)))
  if (contFn(s1)) {
    return foldChunkSplit(s1, chunk, contFn, f, index + 1, length)
  }
  return [s1, pipe(chunk, Chunk.drop(index + 1))] as const
}

/** @internal */
export const foldSink = <
  R1,
  R2,
  E,
  E1,
  E2,
  In,
  In1 extends In,
  In2 extends In,
  L,
  L1,
  L2,
  Z,
  Z1,
  Z2
>(
  onFailure: (err: E) => Sink.Sink<R1, E1, In1, L1, Z1>,
  onSuccess: (z: Z) => Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R>(
    self: Sink.Sink<R, E, In, L, Z>
  ): Sink.Sink<R | R1 | R2, E1 | E2, In1 & In2, L1 | L2, Z1 | Z2> => {
    const newChannel: Channel.Channel<
      R | R1 | R2,
      never,
      Chunk.Chunk<In1 & In2>,
      unknown,
      E1 | E2,
      Chunk.Chunk<L1 | L2>,
      Z1 | Z2
    > = pipe(
      self.channel,
      core.collectElements,
      channel.foldChannel(
        (error) => onFailure(error).channel,
        ([leftovers, z]) =>
          core.suspend(() => {
            const leftoversRef = {
              ref: pipe(leftovers, Chunk.filter(Chunk.isNonEmpty)) as Chunk.Chunk<Chunk.Chunk<L1 | L2>>
            }
            const refReader = pipe(
              core.sync(() => {
                const ref = leftoversRef.ref
                leftoversRef.ref = Chunk.empty()
                return ref
              }),
              // This cast is safe because of the L1 >: L <: In1 bound. It follows that
              // L <: In1 and therefore Chunk[L] can be safely cast to Chunk[In1].
              core.flatMap((chunk) => channel.writeChunk(chunk as Chunk.Chunk<Chunk.Chunk<In1 & In2>>))
            )
            const passthrough = channel.identityChannel<never, Chunk.Chunk<In1 & In2>, unknown>()
            const continuationSink = pipe(
              refReader,
              channel.zipRight(passthrough),
              core.pipeTo(onSuccess(z).channel)
            )
            return pipe(
              continuationSink,
              core.collectElements,
              core.flatMap(([newLeftovers, z1]) =>
                pipe(
                  core.succeed(leftoversRef.ref),
                  core.flatMap(channel.writeChunk),
                  channel.zipRight(channel.writeChunk(newLeftovers)),
                  channel.as(z1)
                )
              )
            )
          })
      )
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
export const foldChunks = <S, In>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, chunk: Chunk.Chunk<In>) => S
): Sink.Sink<never, never, In, never, S> => suspend(() => new SinkImpl(foldChunksReader(s, contFn, f)))

/** @internal */
const foldChunksReader = <S, In>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, chunk: Chunk.Chunk<In>) => S
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, never, S> => {
  if (!contFn(s)) {
    return core.succeedNow(s)
  }
  return core.readWith(
    (input: Chunk.Chunk<In>) => foldChunksReader(f(s, input), contFn, f),
    core.fail,
    () => core.succeedNow(s)
  )
}

/** @internal */
export const foldChunksEffect = <S, R, E, In>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, chunk: Chunk.Chunk<In>) => Effect.Effect<R, E, S>
): Sink.Sink<R, E, In, In, S> => suspend(() => new SinkImpl(foldChunksEffectReader(s, contFn, f)))

/** @internal */
const foldChunksEffectReader = <S, R, E, In>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, chunk: Chunk.Chunk<In>) => Effect.Effect<R, E, S>
): Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, never, S> => {
  if (!contFn(s)) {
    return core.succeedNow(s)
  }
  return core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(f(s, input)),
        core.flatMap((s) => foldChunksEffectReader(s, contFn, f))
      ),
    core.fail,
    () => core.succeedNow(s)
  )
}

/** @internal */
export const foldEffect = <S, R, E, In>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Sink.Sink<R, E, In, In, S> => suspend(() => new SinkImpl(foldEffectReader(s, contFn, f)))

/** @internal */
const foldEffectReader = <S, In, R, E>(
  s: S,
  contFn: Predicate<S>,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, S> => {
  if (!contFn(s)) {
    return core.succeedNow(s)
  }
  return core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(foldChunkSplitEffect(s, input, contFn, f)),
        core.flatMap(([nextS, leftovers]) =>
          pipe(
            leftovers,
            Option.match(
              () => foldEffectReader(nextS, contFn, f),
              (leftover) => pipe(core.write(leftover), channel.as(nextS))
            )
          )
        )
      ),
    core.fail,
    () => core.succeedNow(s)
  )
}

/** @internal */
const foldChunkSplitEffect = <S, R, E, In>(
  s: S,
  chunk: Chunk.Chunk<In>,
  contFn: Predicate<S>,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Effect.Effect<R, E, readonly [S, Option.Option<Chunk.Chunk<In>>]> =>
  foldChunkSplitEffectInternal(s, chunk, 0, chunk.length, contFn, f)

/** @internal */
const foldChunkSplitEffectInternal = <S, R, E, In>(
  s: S,
  chunk: Chunk.Chunk<In>,
  index: number,
  length: number,
  contFn: Predicate<S>,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Effect.Effect<R, E, readonly [S, Option.Option<Chunk.Chunk<In>>]> => {
  if (index === length) {
    return Effect.succeed([s, Option.none] as const)
  }
  return pipe(
    f(s, pipe(chunk, Chunk.unsafeGet(index))),
    Effect.flatMap((s1) =>
      contFn(s1) ?
        foldChunkSplitEffectInternal(s1, chunk, index + 1, length, contFn, f) :
        Effect.succeed([s1, Option.some(pipe(chunk, Chunk.drop(index + 1)))] as const)
    )
  )
}

/** @internal */
export const foldLeft = <S, In>(s: S, f: (s: S, input: In) => S): Sink.Sink<never, never, In, never, S> =>
  ignoreLeftover(fold(s, constTrue, f))

/** @internal */
export const foldLeftChunks = <S, In>(
  s: S,
  f: (s: S, chunk: Chunk.Chunk<In>) => S
): Sink.Sink<never, never, In, never, S> => foldChunks(s, constTrue, f)

/** @internal */
export const foldLeftChunksEffect = <S, R, E, In>(
  s: S,
  f: (s: S, chunk: Chunk.Chunk<In>) => Effect.Effect<R, E, S>
): Sink.Sink<R, E, In, never, S> => ignoreLeftover(foldChunksEffect(s, constTrue, f))

/** @internal */
export const foldLeftEffect = <S, R, E, In>(
  s: S,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Sink.Sink<R, E, In, In, S> => foldEffect(s, constTrue, f)

/** @internal */
export const foldUntil = <S, In>(s: S, max: number, f: (z: S, input: In) => S): Sink.Sink<never, never, In, In, S> =>
  pipe(
    fold<readonly [S, number], In>(
      [s, 0],
      (tuple) => tuple[1] < max,
      ([output, count], input) => [f(output, input), count + 1] as const
    ),
    map((tuple) => tuple[0])
  )

/** @internal */
export const foldUntilEffect = <S, R, E, In>(
  s: S,
  max: number,
  f: (s: S, input: In) => Effect.Effect<R, E, S>
): Sink.Sink<R, E, In, In, S> =>
  pipe(
    foldEffect(
      [s, 0 as number] as const,
      (tuple) => tuple[1] < max,
      ([output, count], input: In) => pipe(f(output, input), Effect.map((s) => [s, count + 1] as const))
    ),
    map((tuple) => tuple[0])
  )

/** @internal */
export const foldWeighted = <S, In>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => number,
  f: (s: S, input: In) => S
): Sink.Sink<never, never, In, In, S> => foldWeightedDecompose(s, max, costFn, Chunk.singleton, f)

/** @internal */
export const foldWeightedDecompose = <S, In>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => number,
  decompose: (input: In) => Chunk.Chunk<In>,
  f: (s: S, input: In) => S
): Sink.Sink<never, never, In, In, S> =>
  suspend(() => new SinkImpl(foldWeightedDecomposeLoop(s, 0, false, max, costFn, decompose, f)))

/** @internal */
const foldWeightedDecomposeLoop = <S, In>(
  s: S,
  cost: number,
  dirty: boolean,
  max: number,
  costFn: (s: S, input: In) => number,
  decompose: (input: In) => Chunk.Chunk<In>,
  f: (s: S, input: In) => S
): Channel.Channel<never, never, Chunk.Chunk<In>, unknown, never, Chunk.Chunk<In>, S> =>
  core.readWith(
    (input: Chunk.Chunk<In>) => {
      const [nextS, nextCost, nextDirty, leftovers] = foldWeightedDecomposeFold(
        input,
        0,
        s,
        cost,
        dirty,
        max,
        costFn,
        decompose,
        f
      )
      if (Chunk.isNonEmpty(leftovers)) {
        return pipe(core.write(leftovers), channel.zipRight(core.succeedNow(nextS)))
      }
      if (cost > max) {
        return core.succeedNow(nextS)
      }
      return foldWeightedDecomposeLoop(nextS, nextCost, nextDirty, max, costFn, decompose, f)
    },
    core.fail,
    () => core.succeedNow(s)
  )

/** @internal */
const foldWeightedDecomposeFold = <In, S>(
  input: Chunk.Chunk<In>,
  index: number,
  s: S,
  cost: number,
  dirty: boolean,
  max: number,
  costFn: (s: S, input: In) => number,
  decompose: (input: In) => Chunk.Chunk<In>,
  f: (s: S, input: In) => S
): readonly [S, number, boolean, Chunk.Chunk<In>] => {
  if (index === input.length) {
    return [s, cost, dirty, Chunk.empty<In>()] as const
  }
  const elem = pipe(input, Chunk.unsafeGet(index))
  const total = cost + costFn(s, elem)
  if (total <= max) {
    return foldWeightedDecomposeFold(input, index + 1, f(s, elem), total, true, max, costFn, decompose, f)
  }
  const decomposed = decompose(elem)
  if (decomposed.length <= 1 && !dirty) {
    // If `elem` cannot be decomposed, we need to cross the `max` threshold. To
    // minimize "injury", we only allow this when we haven't added anything else
    // to the aggregate (dirty = false).
    return [f(s, elem), total, true, pipe(input, Chunk.drop(index + 1))] as const
  }
  if (decomposed.length <= 1 && dirty) {
    // If the state is dirty and `elem` cannot be decomposed, we stop folding
    // and include `elem` in the leftovers.
    return [s, cost, dirty, pipe(input, Chunk.drop(index))] as const
  }
  // `elem` got decomposed, so we will recurse with the decomposed elements pushed
  // into the chunk we're processing and see if we can aggregate further.
  const next = pipe(decomposed, Chunk.concat(pipe(input, Chunk.drop(index + 1))))
  return foldWeightedDecomposeFold(next, 0, s, cost, dirty, max, costFn, decompose, f)
}

/** @internal */
export const foldWeightedDecomposeEffect = <S, In, R, E, R2, E2, R3, E3>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => Effect.Effect<R, E, number>,
  decompose: (input: In) => Effect.Effect<R2, E2, Chunk.Chunk<In>>,
  f: (s: S, input: In) => Effect.Effect<R3, E3, S>
): Sink.Sink<R | R2 | R3, E | E2 | E3, In, In, S> =>
  suspend(() => new SinkImpl(foldWeightedDecomposeEffectLoop(s, max, costFn, decompose, f, 0, false)))

/** @internal */
export const foldWeightedEffect = <S, In, R, E, R2, E2>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => Effect.Effect<R, E, number>,
  f: (s: S, input: In) => Effect.Effect<R2, E2, S>
): Sink.Sink<R | R2, E | E2, In, In, S> =>
  foldWeightedDecomposeEffect(
    s,
    max,
    costFn,
    (input) => Effect.succeed(Chunk.singleton(input)),
    f
  )

/** @internal */
const foldWeightedDecomposeEffectLoop = <S, In, R, E, R2, E2, R3, E3>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => Effect.Effect<R, E, number>,
  decompose: (input: In) => Effect.Effect<R2, E2, Chunk.Chunk<In>>,
  f: (s: S, input: In) => Effect.Effect<R3, E3, S>,
  cost: number,
  dirty: boolean
): Channel.Channel<R | R2 | R3, E | E2 | E3, Chunk.Chunk<In>, unknown, E | E2 | E3, Chunk.Chunk<In>, S> =>
  core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(foldWeightedDecomposeEffectFold(s, max, costFn, decompose, f, input, dirty, cost, 0)),
        core.flatMap(([nextS, nextCost, nextDirty, leftovers]) => {
          if (Chunk.isNonEmpty(leftovers)) {
            return pipe(core.write(leftovers), channel.zipRight(core.succeedNow(nextS)))
          }
          if (cost > max) {
            return core.succeedNow(nextS)
          }
          return foldWeightedDecomposeEffectLoop(nextS, max, costFn, decompose, f, nextCost, nextDirty)
        })
      ),
    core.fail,
    () => core.succeedNow(s)
  )

/** @internal */
const foldWeightedDecomposeEffectFold = <S, In, R, E, R2, E2, R3, E3>(
  s: S,
  max: number,
  costFn: (s: S, input: In) => Effect.Effect<R, E, number>,
  decompose: (input: In) => Effect.Effect<R2, E2, Chunk.Chunk<In>>,
  f: (s: S, input: In) => Effect.Effect<R3, E3, S>,
  input: Chunk.Chunk<In>,
  dirty: boolean,
  cost: number,
  index: number
): Effect.Effect<R | R2 | R3, E | E2 | E3, readonly [S, number, boolean, Chunk.Chunk<In>]> => {
  if (index === input.length) {
    return Effect.succeed([s, cost, dirty, Chunk.empty<In>()] as const)
  }
  const elem = pipe(input, Chunk.unsafeGet(index))
  return pipe(
    costFn(s, elem),
    Effect.map((newCost) => cost + newCost),
    Effect.flatMap((total) => {
      if (total <= max) {
        return pipe(
          f(s, elem),
          Effect.flatMap((s) =>
            foldWeightedDecomposeEffectFold(s, max, costFn, decompose, f, input, true, total, index + 1)
          )
        )
      }
      return pipe(
        decompose(elem),
        Effect.flatMap((decomposed) => {
          if (decomposed.length <= 1 && !dirty) {
            // If `elem` cannot be decomposed, we need to cross the `max` threshold. To
            // minimize "injury", we only allow this when we haven't added anything else
            // to the aggregate (dirty = false).
            return pipe(
              f(s, elem),
              Effect.map((s) => [s, total, true, pipe(input, Chunk.drop(index + 1))] as const)
            )
          }
          if (decomposed.length <= 1 && dirty) {
            // If the state is dirty and `elem` cannot be decomposed, we stop folding
            // and include `elem` in th leftovers.
            return Effect.succeed([s, cost, dirty, pipe(input, Chunk.drop(index))] as const)
          }
          // `elem` got decomposed, so we will recurse with the decomposed elements pushed
          // into the chunk we're processing and see if we can aggregate further.
          const next = pipe(decomposed, Chunk.concat(pipe(input, Chunk.drop(index + 1))))
          return foldWeightedDecomposeEffectFold(s, max, costFn, decompose, f, next, dirty, cost, 0)
        })
      )
    })
  )
}

/** @internal */
export const flatMap = <R1, E1, In, In1 extends In, L, L1, Z, Z1>(
  f: (z: Z) => Sink.Sink<R1, E1, In1, L1, Z1>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R1, E | E1, In & In1, L | L1, Z1> =>
    pipe(self, foldSink(fail, f))
}

/** @internal */
export const forEach = <In, R, E, _>(f: (input: In) => Effect.Effect<R, E, _>): Sink.Sink<R, E, In, never, void> => {
  const process: Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, never, void> = core.readWithCause(
    (input: Chunk.Chunk<In>) =>
      pipe(core.fromEffect(pipe(input, Effect.forEachDiscard(f))), core.flatMap(() => process)),
    core.failCause,
    core.unit
  )
  return new SinkImpl(process)
}

/** @internal */
export const forEachChunk = <In, R, E, _>(
  f: (input: Chunk.Chunk<In>) => Effect.Effect<R, E, _>
): Sink.Sink<R, E, In, never, void> => {
  const process: Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, never, void> = core.readWithCause(
    (input: Chunk.Chunk<In>) => pipe(core.fromEffect(f(input)), core.flatMap(() => process)),
    core.failCause,
    core.unit
  )
  return new SinkImpl(process)
}

/** @internal */
export const forEachWhile = <In, R, E>(
  f: (input: In) => Effect.Effect<R, E, boolean>
): Sink.Sink<R, E, In, In, void> => {
  const process: Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, void> = core.readWithCause(
    (input: Chunk.Chunk<In>) => forEachWhileReader(f, input, 0, input.length, process),
    core.failCause,
    core.unit
  )
  return new SinkImpl(process)
}

/** @internal */
const forEachWhileReader = <In, R, E>(
  f: (input: In) => Effect.Effect<R, E, boolean>,
  input: Chunk.Chunk<In>,
  index: number,
  length: number,
  cont: Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, void>
): Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<In>, void> => {
  if (index === length) {
    return cont
  }
  return pipe(
    core.fromEffect(f(pipe(input, Chunk.unsafeGet(index)))),
    core.flatMap((bool) =>
      bool ?
        forEachWhileReader(f, input, index + 1, length, cont) :
        core.write(pipe(input, Chunk.drop(index)))
    ),
    channel.catchAll((error) => pipe(core.write(pipe(input, Chunk.drop(index))), channel.zipRight(core.fail(error))))
  )
}

/** @internal */
export const forEachChunkWhile = <In, R, E>(
  f: (input: Chunk.Chunk<In>) => Effect.Effect<R, E, boolean>
): Sink.Sink<R, E, In, In, void> => {
  const reader: Channel.Channel<R, E, Chunk.Chunk<In>, unknown, E, never, void> = core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(f(input)),
        core.flatMap((cont) => cont ? reader : core.unit())
      ),
    core.fail,
    core.unit
  )
  return new SinkImpl(reader)
}

/** @internal */
export const fromChannel = <R, E, In, L, Z>(
  channel: Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<L>, Z>
): Sink.Sink<R, E, In, L, Z> => new SinkImpl(channel)

/** @internal */
export const fromEffect = <R, E, Z>(effect: Effect.Effect<R, E, Z>): Sink.Sink<R, E, unknown, never, Z> =>
  new SinkImpl(core.fromEffect(effect))

/** @internal */
export const fromHub = <In>(hub: Hub.Hub<In>): Sink.Sink<never, never, In, never, void> => fromQueue(hub)

/** @internal */
export const fromHubWithShutdown = <In>(hub: Hub.Hub<In>): Sink.Sink<never, never, In, never, void> =>
  fromQueueWithShutdown(hub)

/** @internal */
export const fromPush = <R, E, In, L, Z>(
  push: Effect.Effect<
    R | Scope.Scope,
    never,
    (_: Option.Option<Chunk.Chunk<In>>) => Effect.Effect<R, readonly [Either.Either<E, Z>, Chunk.Chunk<L>], void>
  >
): Sink.Sink<R, E, In, L, Z> => new SinkImpl(channel.unwrapScoped(pipe(push, Effect.map(fromPushPull))))

const fromPushPull = <R, E, In, L, Z>(
  push: (
    option: Option.Option<Chunk.Chunk<In>>
  ) => Effect.Effect<R, readonly [Either.Either<E, Z>, Chunk.Chunk<L>], void>
): Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<L>, Z> =>
  core.readWith(
    (input: Chunk.Chunk<In>) =>
      pipe(
        core.fromEffect(push(Option.some(input))),
        channel.foldChannel(
          ([either, leftovers]) =>
            pipe(
              either,
              Either.match(
                (error) => pipe(core.write(leftovers), channel.zipRight(core.fail(error))),
                (z) => pipe(core.write(leftovers), channel.zipRight(core.succeedNow(z)))
              )
            ),
          () => fromPushPull(push)
        )
      ),
    core.fail,
    () =>
      pipe(
        core.fromEffect(push(Option.none)),
        channel.foldChannel(
          ([either, leftovers]) =>
            pipe(
              either,
              Either.match(
                (error) => pipe(core.write(leftovers), channel.zipRight(core.fail(error))),
                (z) => pipe(core.write(leftovers), channel.zipRight(core.succeedNow(z)))
              )
            ),
          () =>
            pipe(
              core.fromEffect(
                Effect.dieMessage(
                  "BUG: Sink.fromPush - please report an issue at https://github.com/Effect-TS/stream/issues"
                )
              )
            )
        )
      )
  )

/** @internal */
export const fromQueue = <In>(queue: Queue.Enqueue<In>): Sink.Sink<never, never, In, never, void> =>
  forEachChunk((input: Chunk.Chunk<In>) => pipe(queue, Queue.offerAll(input)))

/** @internal */
export const fromQueueWithShutdown = <In>(queue: Queue.Enqueue<In>): Sink.Sink<never, never, In, never, void> =>
  pipe(
    Effect.acquireRelease(Effect.succeed(queue), Queue.shutdown),
    Effect.map(fromQueue),
    unwrapScoped
  )

/** @internal */
export const head = <In>(): Sink.Sink<never, never, In, In, Option.Option<In>> =>
  fold(
    Option.none as Option.Option<In>,
    Option.isNone,
    (option, input) => pipe(option, Option.match(() => Option.some(input), () => option))
  )

/** @internal */
export const ignoreLeftover = <R, E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, never, Z> =>
  new SinkImpl(channel.drain(self.channel))

/** @internal */
export const last = <In>(): Sink.Sink<never, never, In, In, Option.Option<In>> =>
  foldLeft(
    Option.none as Option.Option<In>,
    (_, input) => Option.some(input)
  )

/** @internal */
export const leftover = <L>(chunk: Chunk.Chunk<L>): Sink.Sink<never, never, unknown, L, void> =>
  new SinkImpl(core.suspend(() => core.write(chunk)))

/** @internal */
export const log = (message: string): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.log(message))

/** @internal */
export const logDebug = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logDebug(message))

/** @internal */
export const logDebugCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logDebugCause(cause))

/** @internal */
export const logDebugCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logDebugCauseMessage(message, cause))

/** @internal */
export const logError = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logError(message))

/** @internal */
export const logErrorCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logErrorCause(cause))

/** @internal */
export const logErrorCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logErrorCauseMessage(message, cause))

/** @internal */
export const logFatal = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logFatal(message))

/** @internal */
export const logFatalCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logFatalCause(cause))

/** @internal */
export const logFatalCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logFatalCauseMessage(message, cause))

/** @internal */
export const logInfo = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logInfo(message))

/** @internal */
export const logInfoCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logInfoCause(cause))

/** @internal */
export const logInfoCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logInfoCauseMessage(message, cause))

/** @internal */
export const logWarning = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logWarning(message))

/** @internal */
export const logWarningCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logWarningCause(cause))

/** @internal */
export const logWarningCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logWarningCauseMessage(message, cause))

/** @internal */
export const logTrace = (message: string): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logTrace(message))

/** @internal */
export const logTraceCause = <E>(cause: Cause.Cause<E>): Sink.Sink<never, never, unknown, never, void> =>
  fromEffect(Effect.logTraceCause(cause))

/** @internal */
export const logTraceCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Sink.Sink<never, never, unknown, never, void> => fromEffect(Effect.logTraceCauseMessage(message, cause))

/** @internal */
export const map = <Z, Z2>(f: (z: Z) => Z2) => {
  return <R, E, In, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, L, Z2> => {
    return new SinkImpl(pipe(self.channel, channel.map(f)))
  }
}

/** @internal */
export const mapEffect = <Z, R2, E2, Z2>(f: (z: Z) => Effect.Effect<R2, E2, Z2>) => {
  return <R, E, In, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In, L, Z2> =>
    new SinkImpl(pipe(self.channel, channel.mapEffect(f)))
}

/** @internal */
export const mapError = <E, E2>(f: (error: E) => E2) => {
  return <R, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E2, In, L, Z> =>
    new SinkImpl(pipe(self.channel, channel.mapError(f)))
}

/** @internal */
export const mapLeftover = <L, L2>(f: (leftover: L) => L2) => {
  return <R, E, In, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, L2, Z> =>
    new SinkImpl(pipe(self.channel, channel.mapOut(Chunk.map(f))))
}

/** @internal */
export const mkString = (): Sink.Sink<never, never, unknown, never, string> =>
  suspend(() => {
    const strings: Array<string> = []
    return pipe(
      foldLeftChunks<void, unknown>(void 0, (_, elems) =>
        elems.forEach((elem) => {
          strings.push(String(elem))
        })),
      map(() => strings.join(""))
    )
  })

/** @internal */
export const never = (): Sink.Sink<never, never, unknown, never, never> => fromEffect(Effect.never())

/** @internal */
export const orElse = <R2, E2, In2, L2, Z2>(
  that: LazyArg<Sink.Sink<R2, E2, In2, L2, Z2>>
) => {
  return <R, E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z | Z2> =>
    new SinkImpl<R | R2, E | E2, In & In2, L | L2, Z | Z2>(pipe(self.channel, channel.orElse(() => that().channel)))
}

/** @internal */
export const provideEnvironment = <R>(environment: Context.Context<R>) => {
  return <E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<never, E, In, L, Z> =>
    new SinkImpl(pipe(self.channel, core.provideEnvironment(environment)))
}

/** @internal */
export const race = <R1, E1, In1, L1, Z1>(that: Sink.Sink<R1, E1, In1, L1, Z1>) => {
  return <R, E, In, L, Z>(
    self: Sink.Sink<R, E, In, L, Z>
  ): Sink.Sink<R | R1, E | E1, In & In1, L | L1, Z | Z1> => pipe(self, raceBoth(that), map(Either.merge))
}

/** @internal */
export const raceBoth = <R1, E1, In1, L1, Z1>(
  that: Sink.Sink<R1, E1, In1, L1, Z1>,
  capacity = 16
) => {
  return <R, E, In, L, Z>(
    self: Sink.Sink<R, E, In, L, Z>
  ): Sink.Sink<R | R1, E | E1, In & In1, L | L1, Either.Either<Z, Z1>> => {
    return pipe(
      self,
      raceWith(
        that,
        (selfDone) => mergeDecision.Done(pipe(Effect.done(selfDone), Effect.map(Either.left))),
        (thatDone) => mergeDecision.Done(pipe(Effect.done(thatDone), Effect.map(Either.right))),
        capacity
      )
    )
  }
}

/** @internal */
export const raceWith = <R2, E2, In2, L2, Z2, E, Z, Z3, Z4>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>,
  leftDone: (exit: Exit.Exit<E, Z>) => MergeDecision.MergeDecision<R2, E2, Z2, E | E2, Z3>,
  rightDone: (exit: Exit.Exit<E2, Z2>) => MergeDecision.MergeDecision<R2, E, Z, E | E2, Z4>,
  capacity = 16
) => {
  return <R, In, L>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z3 | Z4> => {
    const scoped = Effect.gen(function*($) {
      const hub = yield* $(Hub.bounded<Either.Either<Exit.Exit<never, unknown>, Chunk.Chunk<In & In2>>>(capacity))
      const channel1 = yield* $(channel.fromHubScoped(hub))
      const channel2 = yield* $(channel.fromHubScoped(hub))
      const reader = channel.toHub(hub)
      const writer = pipe(
        channel1,
        core.pipeTo(self.channel),
        channel.mergeWith(
          pipe(channel2, core.pipeTo(that.channel)),
          leftDone,
          rightDone
        )
      )
      const racedChannel: Channel.Channel<
        R | R2,
        never,
        Chunk.Chunk<In & In2>,
        unknown,
        E | E2,
        Chunk.Chunk<L | L2>,
        Z3 | Z4
      > = pipe(
        reader,
        channel.mergeWith(
          writer,
          () => mergeDecision.Await((exit) => Effect.done(exit)),
          (done) => mergeDecision.Done(Effect.done(done))
        )
      )
      return new SinkImpl(racedChannel)
    })
    return unwrapScoped(scoped)
  }
}

/** @internal */
export const refineOrDie = <E, E2>(pf: (error: E) => Option.Option<E2>) => {
  return <R, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E2, In, L, Z> =>
    pipe(self, refineOrDieWith(pf, identity))
}

/** @internal */
export const refineOrDieWith = <E, E2>(pf: (error: E) => Option.Option<E2>, f: (error: E) => unknown) => {
  return <R, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E2, In, L, Z> => {
    const newChannel = pipe(
      self.channel,
      channel.catchAll((error) =>
        pipe(
          pf(error),
          Option.match(
            () => core.failCauseSync(() => Cause.die(f(error))),
            core.fail
          )
        )
      )
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
export const service = <T>(tag: Context.Tag<T>): Sink.Sink<T, never, unknown, never, T> => serviceWith(tag)(identity)

/** @internal */
export const serviceWith = <T>(tag: Context.Tag<T>) => {
  return <Z>(f: (service: T) => Z): Sink.Sink<T, never, unknown, never, Z> => fromEffect(Effect.serviceWith(tag)(f))
}

/** @internal */
export const serviceWithEffect = <T>(tag: Context.Tag<T>) => {
  return <R, E, Z>(f: (service: T) => Effect.Effect<R, E, Z>): Sink.Sink<R | T, E, unknown, never, Z> =>
    fromEffect(Effect.serviceWithEffect(tag)(f))
}

/** @internal */
export const serviceWithSink = <T>(tag: Context.Tag<T>) => {
  return <R, E, In, L, Z>(f: (service: T) => Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | T, E, In, L, Z> =>
    new SinkImpl(pipe(Effect.serviceWith(tag)((service) => f(service).channel), channel.unwrap))
}

/** @internal */
export const some = <In>(predicate: Predicate<In>): Sink.Sink<never, never, In, In, boolean> =>
  fold(false, (bool) => !bool, (acc, input) => acc || predicate(input))

/** @internal */
export const splitWhere = <In>(f: Predicate<In>) => {
  return <R, E, L extends In, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R, E, In, In, Z> => {
    const newChannel = pipe(
      core.fromEffect(Ref.make(Chunk.empty<In>())),
      core.flatMap((ref) =>
        pipe(
          splitWhereSplitter<E, In>(false, ref, f),
          channel.pipeToOrFail(self.channel),
          core.collectElements,
          core.flatMap(([leftovers, z]) =>
            pipe(
              core.fromEffect(Ref.get(ref)),
              core.flatMap((leftover) =>
                pipe(
                  core.write<Chunk.Chunk<In>>(pipe(leftover, Chunk.concat(Chunk.flatten(leftovers)))),
                  channel.zipRight(core.succeed(z))
                )
              )
            )
          )
        )
      )
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
const splitWhereSplitter = <E, A>(
  written: boolean,
  leftovers: Ref.Ref<Chunk.Chunk<A>>,
  f: Predicate<A>
): Channel.Channel<never, never, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> =>
  core.readWithCause(
    (input) => {
      if (Chunk.isEmpty(input)) {
        return splitWhereSplitter<E, A>(written, leftovers, f)
      }
      if (written) {
        const index = indexWhere(input, f)
        if (index === -1) {
          return pipe(core.write(input), channel.zipRight(splitWhereSplitter<E, A>(true, leftovers, f)))
        }
        const [left, right] = pipe(input, Chunk.splitAt(index))
        return pipe(core.write(left), channel.zipRight(core.fromEffect(pipe(leftovers, Ref.set(right)))))
      }
      const index = indexWhere(input, f, 1)
      if (index === -1) {
        return pipe(core.write(input), channel.zipRight(splitWhereSplitter<E, A>(true, leftovers, f)))
      }
      const [left, right] = pipe(input, Chunk.splitAt(Math.max(index, 1)))
      return pipe(core.write(left), channel.zipRight(core.fromEffect(pipe(leftovers, Ref.set(right)))))
    },
    core.failCause,
    core.succeed
  )

/** @internal */
const indexWhere = <A>(self: Chunk.Chunk<A>, predicate: Predicate<A>, from = 0): number => {
  const iterator = self[Symbol.iterator]()
  let index = 0
  let result = -1
  let next: IteratorResult<A, any>
  while (result < 0 && (next = iterator.next()) && !next.done) {
    const a = next.value
    if (index >= from && predicate(a)) {
      result = index
    }
    index = index + 1
  }
  return result
}

/** @internal */
export const succeed = <Z>(z: Z): Sink.Sink<never, never, unknown, never, Z> => new SinkImpl(core.succeed(z))

/** @internal */
export const sum = (): Sink.Sink<never, never, number, never, number> => foldLeft(0, (a, b) => a + b)

/** @internal */
export const summarized = <R2, E2, Z2, Z3>(
  summary: Effect.Effect<R2, E2, Z2>,
  f: (start: Z2, end: Z2) => Z3
) => {
  return <R, E, In, L, Z>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In, L, readonly [Z, Z3]> => {
    const newChannel = pipe(
      core.fromEffect(summary),
      core.flatMap((start) =>
        pipe(
          self.channel,
          core.flatMap((done) =>
            pipe(
              core.fromEffect(summary),
              channel.map((end) => [done, f(start, end)] as const)
            )
          )
        )
      )
    )
    return new SinkImpl(newChannel)
  }
}

/** @internal */
export const suspend = <R, E, In, L, Z>(evaluate: LazyArg<Sink.Sink<R, E, In, L, Z>>): Sink.Sink<R, E, In, L, Z> =>
  new SinkImpl(core.suspend(() => evaluate().channel))

/** @internal */
export const sync = <Z>(evaluate: LazyArg<Z>): Sink.Sink<never, never, unknown, never, Z> =>
  new SinkImpl(core.sync(evaluate))

/** @internal */
export const take = <In>(n: number): Sink.Sink<never, never, In, In, Chunk.Chunk<In>> =>
  pipe(
    foldChunks<Chunk.Chunk<In>, In>(
      Chunk.empty(),
      (chunk) => chunk.length < n,
      (acc, chunk) => pipe(acc, Chunk.concat(chunk))
    ),
    flatMap((acc) => {
      const [taken, leftover] = pipe(acc, Chunk.splitAt(n))
      return new SinkImpl(pipe(core.write(leftover), channel.zipRight(core.succeedNow(taken))))
    })
  )

/** @internal */
export const timed = (): Sink.Sink<never, never, unknown, never, Duration.Duration> =>
  pipe(withDuration(drain()), map((tuple) => tuple[1]))

/** @internal */
export const toChannel = <R, E, In, L, Z>(
  self: Sink.Sink<R, E, In, L, Z>
): Channel.Channel<R, never, Chunk.Chunk<In>, unknown, E, Chunk.Chunk<L>, Z> => self.channel

/** @internal */
export const unwrap = <R, E, R2, E2, In, L, Z>(
  effect: Effect.Effect<R, E, Sink.Sink<R2, E2, In, L, Z>>
): Sink.Sink<R | R2, E | E2, In, L, Z> =>
  new SinkImpl(
    channel.unwrap(pipe(effect, Effect.map((sink) => sink.channel)))
  )

/** @internal */
export const unwrapScoped = <R, E, In, L, Z>(
  effect: Effect.Effect<R | Scope.Scope, E, Sink.Sink<R, E, In, L, Z>>
): Sink.Sink<R, E, In, L, Z> => {
  return new SinkImpl(channel.unwrapScoped(pipe(effect, Effect.map((sink) => sink.channel))))
}

/** @internal */
export const withDuration = <R, E, In, L, Z>(
  self: Sink.Sink<R, E, In, L, Z>
): Sink.Sink<R, E, In, L, readonly [Z, Duration.Duration]> =>
  pipe(self, summarized(Clock.currentTimeMillis(), (start, end) => Duration.millis(end - start)))

/** @internal */
export const zip = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, readonly [Z, Z2]> =>
    pipe(self, zipWith(that, (z, z2) => [z, z2]))
}

/** @internal */
export const zipLeft = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z> =>
    pipe(self, zipWith(that, (z, _) => z))
}

/** @internal */
export const zipRight = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z2> =>
    pipe(self, zipWith(that, (_, z2) => z2))
}

/** @internal */
export const zipWith = <R2, E2, In, In2 extends In, L, L2, Z, Z2, Z3>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>,
  f: (z: Z, z1: Z2) => Z3
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z3> =>
    pipe(self, flatMap((z) => pipe(that, map((z2) => f(z, z2)))))
}

/** @internal */
export const zipPar = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, readonly [Z, Z2]> =>
    pipe(self, zipWithPar(that, (z, z2) => [z, z2]))
}

/** @internal */
export const zipParLeft = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z> =>
    pipe(self, zipWithPar(that, (z, _) => z))
}

/** @internal */
export const zipParRight = <R2, E2, In, In2 extends In, L, L2, Z, Z2>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z2> =>
    pipe(self, zipWithPar(that, (_, z2) => z2))
}

/** @internal */
export const zipWithPar = <R2, E2, In, In2 extends In, L, L2, Z, Z2, Z3>(
  that: Sink.Sink<R2, E2, In2, L2, Z2>,
  f: (z: Z, z1: Z2) => Z3
) => {
  return <R, E>(self: Sink.Sink<R, E, In, L, Z>): Sink.Sink<R | R2, E | E2, In & In2, L | L2, Z3> => {
    return pipe(
      self,
      raceWith(
        that,
        Exit.match(
          (cause) => mergeDecision.Done(Effect.failCause(cause)),
          (leftZ) =>
            mergeDecision.Await<R | R2, E2, Z2, E | E2, Z3>(
              Exit.match<E2, Z2, Effect.Effect<R | R2, E | E2, Z3>>(
                Effect.failCause,
                (rightZ) => Effect.succeed(f(leftZ, rightZ))
              )
            )
        ),
        Exit.match(
          (cause) => mergeDecision.Done(Effect.failCause(cause)),
          (rightZ) =>
            mergeDecision.Await<R | R2, E, Z, E | E2, Z3>(
              Exit.match<E, Z, Effect.Effect<R | R2, E | E2, Z3>>(
                Effect.failCause,
                (leftZ) => Effect.succeed(f(leftZ, rightZ))
              )
            )
        )
      )
    )
  }
}

// Circular with Channel

/** @internal */
export const channelToSink = <Env, InErr, InElem, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, InErr, Chunk.Chunk<InElem>, unknown, OutErr, Chunk.Chunk<OutElem>, OutDone>
): Sink.Sink<Env, OutErr, InElem, OutElem, OutDone> => new SinkImpl(self)
