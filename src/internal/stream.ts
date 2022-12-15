import * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import type * as Scope from "@effect/io/Scope"
import type * as Channel from "@effect/stream/Channel"
import * as channel from "@effect/stream/internal/channel"
import * as core from "@effect/stream/internal/core"
import * as _sink from "@effect/stream/internal/sink"
import * as Handoff from "@effect/stream/internal/stream/handoff"
import type * as Sink from "@effect/stream/Sink"
import type * as Stream from "@effect/stream/Stream"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import type { LazyArg } from "@fp-ts/data/Function"
import { identity, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const StreamSymbolKey = "@effect/stream/Stream"

/** @internal */
export const StreamTypeId: Stream.StreamTypeId = Symbol.for(
  StreamSymbolKey
) as Stream.StreamTypeId

/** @internal */
const streamVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
export class StreamImpl<R, E, A> implements Stream.Stream<R, E, A> {
  readonly [StreamTypeId] = streamVariance
  constructor(
    readonly channel: Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown>
  ) {}
}

/** @internal */
export const DefaultChunkSize = 4096

/** @internal */
export const catchAll = <E, R2, E2, A2>(f: (error: E) => Stream.Stream<R2, E2, A2>) => {
  return <R, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E2, A | A2> =>
    pipe(
      self,
      catchAllCause((cause) => pipe(Cause.failureOrCause(cause), Either.match(f, failCause)))
    )
}
/** @internal */
export const catchAllCause = <E, R2, E2, A2>(f: (cause: Cause.Cause<E>) => Stream.Stream<R2, E2, A2>) => {
  return <R, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E2, A | A2> =>
    new StreamImpl<R | R2, E2, A | A2>(pipe(self.channel, core.catchAllCause((cause) => f(cause).channel)))
}

/** @internal */
export const concat = <R2, E2, A2>(that: Stream.Stream<R2, E2, A2>) => {
  return <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, A | A2> =>
    new StreamImpl<R | R2, E | E2, A | A2>(pipe(self.channel, channel.zipRight(that.channel)))
}

/** @internal */
export const either = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, never, Either.Either<E, A>> =>
  pipe(self, map(Either.right), catchAll((error) => make(Either.left(error))))

/** @internal */
export const empty: Stream.Stream<never, never, never> = new StreamImpl(core.write(Chunk.empty()))

/** @internal */
export const fail = <E>(error: E): Stream.Stream<never, E, never> => fromEffectOption(Effect.fail(Option.some(error)))

/** @internal */
export const failSync = <E>(evaluate: LazyArg<E>): Stream.Stream<never, E, never> =>
  fromEffectOption(Effect.failSync(() => Option.some(evaluate())))

/** @internal */
export const failCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, E, never> =>
  fromEffect(Effect.failCause(cause))

/** @internal */
export const failCauseSync = <E>(evaluate: LazyArg<Cause.Cause<E>>): Stream.Stream<never, E, never> =>
  fromEffect(Effect.failCauseSync(evaluate))

/** @internal */
export const flatMap = <A, R2, E2, A2>(f: (a: A) => Stream.Stream<R2, E2, A2>) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, A2> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.concatMap((as) =>
          pipe(
            as,
            Chunk.map((a) => f(a).channel),
            Chunk.reduce(
              core.unit() as Channel.Channel<R2, unknown, unknown, unknown, E2, Chunk.Chunk<A2>, unknown>,
              (left, right) => pipe(left, core.flatMap(() => right))
            )
          )
        )
      )
    )
}

/** @internal */
export const flatten = <R, E, R2, E2, A>(
  self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => pipe(self, flatMap(identity))

/** @internal */
export const fromChunk = <A>(chunk: Chunk.Chunk<A>): Stream.Stream<never, never, A> =>
  new StreamImpl(Chunk.isEmpty(chunk) ? core.unit() : core.write(chunk))

/** @internal */
export const fromChunks = <A>(
  ...chunks: Array<Chunk.Chunk<A>>
): Stream.Stream<never, never, A> => pipe(fromIterable(chunks), flatMap(fromChunk))

/** @internal */
export const fromEffect = <R, E, A>(effect: Effect.Effect<R, E, A>): Stream.Stream<R, E, A> =>
  pipe(effect, Effect.mapError(Option.some), fromEffectOption)

/** @internal */
export const fromEffectOption = <R, E, A>(effect: Effect.Effect<R, Option.Option<E>, A>): Stream.Stream<R, E, A> =>
  new StreamImpl(
    pipe(
      effect,
      Effect.fold(Option.match(core.unit, core.fail), (a) => core.write(Chunk.singleton(a))),
      channel.unwrap
    )
  )

/** @internal */
export const fromIterable = <A>(iterable: Iterable<A>): Stream.Stream<never, never, A> =>
  fromChunk(Chunk.fromIterable(iterable))

/** @internal */
export const fromIterableEffect = <R, E, A>(
  effect: Effect.Effect<R, E, Iterable<A>>
): Stream.Stream<R, E, A> => pipe(effect, Effect.map(fromIterable), unwrap)

/** @internal */
export const make = <As extends Array<any>>(...as: As): Stream.Stream<never, never, As[number]> => fromIterable(as)

/** @internal */
export const map = <A, A2>(f: (a: A) => A2) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A2> =>
    new StreamImpl(pipe(self.channel, channel.mapOut(Chunk.map(f))))
}

/** @internal */
export const mapEffect = <A, R2, E2, A2>(f: (a: A) => Effect.Effect<R2, E2, A2>) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, A2> =>
    suspend(() =>
      new StreamImpl(pipe(
        self.channel,
        core.pipeTo(mapEffectLoop(Chunk.empty<A>()[Symbol.iterator](), f))
      ))
    )
}

/** @internal */
const mapEffectLoop = <E, A, R2, E2, A2>(
  chunkIterator: Iterator<A>,
  f: (a: A) => Effect.Effect<R2, E2, A2>
): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A2>, unknown> => {
  const next = chunkIterator.next()
  if (next.done) {
    return core.readWithCause(
      (elem) => mapEffectLoop(elem[Symbol.iterator](), f),
      core.failCause,
      core.succeed
    )
  } else {
    return pipe(
      Effect.suspendSucceed(() => f(next.value)),
      Effect.map((a2) =>
        pipe(
          core.write(Chunk.singleton(a2)),
          core.flatMap(() => mapEffectLoop<E, A, R2, E2, A2>(chunkIterator, f))
        )
      ),
      channel.unwrap
    )
  }
}

/** @internal */
export const mapError = <E, E2>(f: (error: E) => E2) => {
  return <R, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E2, A> =>
    new StreamImpl(pipe(self.channel, channel.mapError(f)))
}

/** @internal */
export const mapErrorCause = <E, E2>(f: (cause: Cause.Cause<E>) => Cause.Cause<E2>) => {
  return <R, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E2, A> =>
    new StreamImpl(pipe(self.channel, channel.mapErrorCause(f)))
}

/** @internal */
export const peel = <R2, E2, A, Z>(sink: Sink.Sink<R2, E2, A, A, Z>) => {
  return <R, E>(
    self: Stream.Stream<R, E, A>
  ): Effect.Effect<R | R2 | Scope.Scope, E2 | E, readonly [Z, Stream.Stream<never, E, A>]> => {
    const trace = getCallTrace()
    type Signal = Emit | Halt | End
    const OP_EMIT = 0 as const
    type OP_EMIT = typeof OP_EMIT
    const OP_HALT = 1 as const
    type OP_HALT = typeof OP_HALT
    const OP_END = 2 as const
    type OP_END = typeof OP_END
    interface Emit {
      readonly op: OP_EMIT
      readonly elements: Chunk.Chunk<A>
    }
    interface Halt {
      readonly op: OP_HALT
      readonly cause: Cause.Cause<E>
    }
    interface End {
      readonly op: OP_END
    }
    return pipe(
      Deferred.make<E | E2, Z>(),
      Effect.flatMap((deferred) =>
        pipe(
          Handoff.make<Signal>(),
          Effect.map((handoff) => {
            const consumer = pipe(
              _sink.collectLeftover(sink),
              _sink.foldSink(
                (error) =>
                  pipe(
                    _sink.fromEffect(pipe(deferred, Deferred.fail<E | E2>(error))),
                    _sink.zipRight(_sink.fail(error))
                  ),
                ([z, leftovers]) => {
                  const loop: Channel.Channel<
                    never,
                    E,
                    Chunk.Chunk<A>,
                    unknown,
                    E | E2,
                    Chunk.Chunk<A>,
                    void
                  > = core
                    .readWithCause(
                      (elements) =>
                        pipe(
                          core.fromEffect(
                            pipe(
                              handoff,
                              Handoff.offer<Signal>({ op: OP_EMIT, elements })
                            )
                          ),
                          core.flatMap(() => loop)
                        ),
                      (cause) =>
                        pipe(
                          core.fromEffect(pipe(handoff, Handoff.offer<Signal>({ op: OP_HALT, cause }))),
                          channel.zipRight(core.failCause(cause))
                        ),
                      (_) =>
                        pipe(
                          core.fromEffect(pipe(handoff, Handoff.offer<Signal>({ op: OP_END }))),
                          channel.zipRight(core.unit())
                        )
                    )
                  return _sink.fromChannel(
                    pipe(
                      core.fromEffect(pipe(deferred, Deferred.succeed(z))),
                      channel.zipRight(core.fromEffect(
                        pipe(
                          handoff,
                          Handoff.offer<Signal>({ op: OP_EMIT, elements: leftovers })
                        )
                      )),
                      channel.zipRight(loop)
                    )
                  )
                }
              )
            )

            const producer: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
              Handoff.take(handoff),
              Effect.map((signal) => {
                switch (signal.op) {
                  case OP_EMIT: {
                    return pipe(core.write(signal.elements), core.flatMap(() => producer))
                  }
                  case OP_HALT: {
                    return core.failCause(signal.cause)
                  }
                  case OP_END: {
                    return core.unit()
                  }
                }
              }),
              channel.unwrap
            )

            return pipe(
              self,
              tapErrorCause((cause) => pipe(deferred, Deferred.failCause<E | E2>(cause))),
              run(consumer),
              Effect.forkScoped,
              Effect.zipRight(Deferred.await(deferred)),
              Effect.map((z) => [z, new StreamImpl(producer)] as const)
            )
          })
        )
      ),
      Effect.flatten,
      Effect.traced(trace)
    )
  }
}

/** @internal */
export const pipeThrough = <R2, E2, A, L, Z>(sink: Sink.Sink<R2, E2, A, L, Z>) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, L> =>
    new StreamImpl(pipe(self.channel, channel.pipeToOrFail(sink.channel)))
}

/** @internal */
export const range = (min: number, max: number, chunkSize = DefaultChunkSize): Stream.Stream<never, never, number> =>
  suspend(() => {
    const go = (
      min: number,
      max: number,
      chunkSize: number
    ): Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<number>, unknown> => {
      const remaining = max - min
      if (remaining > chunkSize) {
        return pipe(
          core.write(Chunk.range(min, min + chunkSize - 1)),
          core.flatMap(() => go(min + chunkSize, max, chunkSize))
        )
      }
      return core.write(Chunk.range(min, min + remaining - 1))
    }
    return new StreamImpl(go(min, max, chunkSize))
  })

/** @internal */
export const rechunk = (n: number) => {
  return <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A> =>
    suspend(() => {
      const target = Math.max(n, 1)
      const process = rechunkProcess<E, A>(new StreamRechunker(target), target)
      return new StreamImpl(pipe(self.channel, core.pipeTo(process)))
    })
}

/** @internal */
const rechunkProcess = <E, A>(
  rechunker: StreamRechunker<E, A>,
  target: number
): Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> =>
  core.readWithCause(
    (chunk: Chunk.Chunk<A>) => {
      if (chunk.length === target && rechunker.isEmpty()) {
        return pipe(core.write(chunk), core.flatMap(() => rechunkProcess(rechunker, target)))
      }
      if (chunk.length > 0) {
        const chunks: Array<Chunk.Chunk<A>> = []
        let result: Chunk.Chunk<A> | undefined = undefined
        let index = 0
        while (index < chunk.length) {
          while (index < chunk.length && result === undefined) {
            result = rechunker.write(pipe(chunk, Chunk.unsafeGet(index)))
            index = index + 1
          }
          if (result !== undefined) {
            chunks.push(result)
            result = undefined
          }
        }
        return pipe(channel.writeAll(...chunks), core.flatMap(() => rechunkProcess(rechunker, target)))
      }
      return core.suspend(() => rechunkProcess(rechunker, target))
    },
    (cause) => pipe(rechunker.emitIfNotEmpty(), channel.zipRight(core.failCause(cause))),
    () => rechunker.emitIfNotEmpty()
  )

/** @internal */
class StreamRechunker<E, A> {
  private builder: Array<A> = []
  private pos = 0

  constructor(readonly n: number) {}

  isEmpty(): boolean {
    return this.pos === 0
  }

  write(elem: A): Chunk.Chunk<A> | undefined {
    this.builder.push(elem)
    this.pos += 1

    if (this.pos === this.n) {
      const result = Chunk.unsafeFromArray(this.builder)
      this.builder = []
      this.pos = 0
      return result
    }

    return undefined
  }

  emitIfNotEmpty(): Channel.Channel<never, E, unknown, unknown, E, Chunk.Chunk<A>, void> {
    if (this.pos !== 0) {
      return core.write(Chunk.unsafeFromArray(this.builder))
    }
    return core.unit()
  }
}

/** @internal */
export const run = <R2, E2, A, Z>(sink: Sink.Sink<R2, E2, A, unknown, Z>) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Effect.Effect<R | R2, E | E2, Z> =>
    pipe(self.channel, channel.pipeToOrFail(sink.channel), channel.runDrain)
}

/** @internal */
export const runCollect = <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, Chunk.Chunk<A>> =>
  pipe(self, run(_sink.collectAll()))

/** @internal */
export const suspend = <R, E, A>(stream: LazyArg<Stream.Stream<R, E, A>>): Stream.Stream<R, E, A> =>
  new StreamImpl(core.suspend(() => stream().channel))

/** @internal */
export const tapErrorCause = <E, R2, E2, _>(f: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, _>) => {
  return <R, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      self,
      catchAllCause((cause) => fromEffect(pipe(f(cause), Effect.zipRight(Effect.failCause(cause)))))
    )
}

/** @internal */
export const transduce = <R2, E2, A, Z>(
  sink: Sink.Sink<R2, E2, A, A, Z>
) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, Z> => {
    const newChannel = core.suspend(() => {
      const leftovers = { ref: Chunk.empty<Chunk.Chunk<A>>() }
      const upstreamDone = { ref: false }
      const buffer: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> = core.suspend(
        () => {
          const leftover = leftovers.ref
          if (Chunk.isEmpty(leftover)) {
            return core.readWith(
              (input) => pipe(core.write(input), core.flatMap(() => buffer)),
              core.fail,
              core.succeedNow
            )
          }
          leftovers.ref = Chunk.empty<Chunk.Chunk<A>>()
          return pipe(channel.writeChunk(leftover), core.flatMap(() => buffer))
        }
      )
      const concatAndGet = (chunk: Chunk.Chunk<Chunk.Chunk<A>>): Chunk.Chunk<Chunk.Chunk<A>> => {
        const leftover = leftovers.ref
        const concatenated = pipe(leftover, Chunk.concat(pipe(chunk, Chunk.filter((chunk) => chunk.length !== 0))))
        leftovers.ref = concatenated
        return concatenated
      }
      const upstreamMarker: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> = core
        .readWith(
          (input: Chunk.Chunk<A>) => pipe(core.write(input), core.flatMap(() => upstreamMarker)),
          core.fail,
          (done) =>
            pipe(
              core.sync(() => {
                upstreamDone.ref = true
              }),
              channel.zipRight(core.succeedNow(done))
            )
        )
      const transducer: Channel.Channel<R | R2, never, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<Z>, void> = pipe(
        sink.channel,
        core.collectElements,
        core.flatMap(([leftover, z]) =>
          pipe(
            core.succeed([upstreamDone.ref, concatAndGet(leftover)] as const),
            core.flatMap(([done, newLeftovers]) => {
              const nextChannel = done && Chunk.isEmpty(newLeftovers) ?
                core.unit() :
                transducer
              return pipe(core.write(Chunk.singleton(z)), core.flatMap(() => nextChannel))
            })
          )
        )
      )
      return pipe(
        self.channel,
        core.pipeTo(upstreamMarker),
        core.pipeTo(buffer),
        channel.pipeToOrFail(transducer)
      )
    })
    return new StreamImpl(newChannel)
  }
}

/** @internal */
export const unwrap = <R, E, R2, E2, A>(
  effect: Effect.Effect<R, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => flatten(fromEffect(effect))

// Circular with Channel

/** @internal */
export const channelToStream = <Env, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, Chunk.Chunk<OutElem>, OutDone>
): Stream.Stream<Env, OutErr, OutElem> => {
  return new StreamImpl(self)
}
