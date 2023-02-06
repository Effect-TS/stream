import * as Cause from "@effect/io/Cause"
import * as Clock from "@effect/io/Clock"
import * as Debug from "@effect/io/Debug"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as Hub from "@effect/io/Hub"
import * as Layer from "@effect/io/Layer"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Runtime from "@effect/io/Runtime"
import * as Schedule from "@effect/io/Schedule"
import type * as Scope from "@effect/io/Scope"
import type * as Channel from "@effect/stream/Channel"
import * as MergeDecision from "@effect/stream/Channel/MergeDecision"
import * as channel from "@effect/stream/internal/channel"
import * as channelExecutor from "@effect/stream/internal/channel/channelExecutor"
import * as MergeStrategy from "@effect/stream/internal/channel/mergeStrategy"
import * as singleProducerAsyncInput from "@effect/stream/internal/channel/singleProducerAsyncInput"
import * as core from "@effect/stream/internal/core"
import * as _sink from "@effect/stream/internal/sink"
import * as DebounceState from "@effect/stream/internal/stream/debounceState"
import * as emit from "@effect/stream/internal/stream/emit"
import * as haltStrategy from "@effect/stream/internal/stream/haltStrategy"
import * as Handoff from "@effect/stream/internal/stream/handoff"
import * as HandoffSignal from "@effect/stream/internal/stream/handoffSignal"
import * as pull from "@effect/stream/internal/stream/pull"
import * as SinkEndReason from "@effect/stream/internal/stream/sinkEndReason"
import * as ZipAllState from "@effect/stream/internal/stream/zipAllState"
import * as ZipChunksState from "@effect/stream/internal/stream/zipChunksState"
import { RingBuffer } from "@effect/stream/internal/support"
import * as _take from "@effect/stream/internal/take"
import type * as Sink from "@effect/stream/Sink"
import type * as Stream from "@effect/stream/Stream"
import type * as Emit from "@effect/stream/Stream/Emit"
import * as HaltStrategy from "@effect/stream/Stream/HaltStrategy"
import type * as Take from "@effect/stream/Take"
import * as Either from "@fp-ts/core/Either"
import type { LazyArg } from "@fp-ts/core/Function"
import { constTrue, identity, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import type { Predicate, Refinement } from "@fp-ts/core/Predicate"
import type * as Order from "@fp-ts/core/typeclass/Order"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Context from "@fp-ts/data/Context"
import * as Duration from "@fp-ts/data/Duration"
import * as Equal from "@fp-ts/data/Equal"

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
  ) {
  }
}

/** @internal */
export const DefaultChunkSize = 4096

/** @internal */
export const absolve = <R, E, A>(self: Stream.Stream<R, E, Either.Either<E, A>>): Stream.Stream<R, E, A> =>
  pipe(self, mapEffect(Effect.fromEither))

/** @internal */
export const acquireRelease = <R, E, A, R2, _>(
  acquire: Effect.Effect<R, E, A>,
  release: (resource: A, exit: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, _>
): Stream.Stream<R | R2, E, A> => scoped(Effect.acquireRelease(acquire, release))

/** @internal */
export const aggregate = Debug.dual<
  <R, E, R2, E2, A, A2, B>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>
  ) => Stream.Stream<R2 | R, E2 | E, B>,
  <R2, E2, A, A2, B>(
    sink: Sink.Sink<R2, E2, A | A2, A2, B>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, B>
>(
  2,
  <R, E, R2, E2, A, A2, B>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>
  ): Stream.Stream<R | R2, E | E2, B> => pipe(self, aggregateWithin(sink, Schedule.forever()))
)

/** @internal */
export const aggregateWithin = Debug.dual<
  <R, E, R2, E2, A, A2, B, R3, C>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ) => Stream.Stream<R2 | R3 | R, E2 | E, B>,
  <R2, E2, A, A2, B, R3, C>(
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R3 | R, E2 | E, B>
>(
  3,
  <R, E, R2, E2, A, A2, B, R3, C>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ): Stream.Stream<R | R2 | R3, E | E2, B> => pipe(self, aggregateWithinEither(sink, schedule), collectRight)
)

/** @internal */
export const aggregateWithinEither = Debug.dual<
  <R, E, R2, E2, A, A2, B, R3, C>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ) => Stream.Stream<R2 | R3 | R, E2 | E, Either.Either<C, B>>,
  <R2, E2, A, A2, B, R3, C>(
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R3 | R, E2 | E, Either.Either<C, B>>
>(
  3,
  <R, E, R2, E2, A, A2, B, R3, C>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A | A2, A2, B>,
    schedule: Schedule.Schedule<R3, Option.Option<B>, C>
  ): Stream.Stream<R | R2 | R3, E | E2, Either.Either<C, B>> => {
    const layer = Effect.tuple(
      Handoff.make<HandoffSignal.HandoffSignal<E | E2, A>>(),
      Ref.make<SinkEndReason.SinkEndReason>(SinkEndReason.SchedulEnd),
      Ref.make(Chunk.empty<A | A2>()),
      Schedule.driver(schedule),
      Ref.make(false),
      Ref.make(false)
    )
    return pipe(
      fromEffect(layer),
      flatMap(([handoff, sinkEndReason, sinkLeftovers, scheduleDriver, consumed, endAfterEmit]) => {
        const handoffProducer: Channel.Channel<never, E | E2, Chunk.Chunk<A>, unknown, never, never, unknown> = core
          .readWithCause(
            (input: Chunk.Chunk<A>) =>
              pipe(
                core.fromEffect(pipe(
                  handoff,
                  Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(HandoffSignal.emit(input)),
                  Effect.when(() => Chunk.isNonEmpty(input))
                )),
                core.flatMap(() => handoffProducer)
              ),
            (cause) =>
              pipe(
                core.fromEffect(
                  pipe(
                    handoff,
                    Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(HandoffSignal.halt(cause))
                  )
                )
              ),
            () =>
              pipe(
                core.fromEffect(
                  pipe(
                    handoff,
                    Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(HandoffSignal.end(SinkEndReason.UpstreamEnd))
                  )
                )
              )
          )
        const handoffConsumer: Channel.Channel<never, unknown, unknown, unknown, E | E2, Chunk.Chunk<A | A2>, void> =
          pipe(
            Ref.getAndSet(sinkLeftovers, Chunk.empty()),
            Effect.flatMap((leftovers) => {
              if (Chunk.isNonEmpty(leftovers)) {
                return pipe(
                  Ref.set(consumed, true),
                  Effect.zipRight(Effect.succeed(pipe(
                    core.write(leftovers),
                    core.flatMap(() => handoffConsumer)
                  )))
                )
              }
              return pipe(
                Handoff.take(handoff),
                Effect.map((signal) => {
                  switch (signal._tag) {
                    case HandoffSignal.OP_EMIT: {
                      return pipe(
                        core.fromEffect(Ref.set(consumed, true)),
                        channel.zipRight(core.write(signal.elements)),
                        channel.zipRight(core.fromEffect(Ref.get(endAfterEmit))),
                        core.flatMap((bool) => bool ? core.unit() : handoffConsumer)
                      )
                    }
                    case HandoffSignal.OP_HALT: {
                      return core.failCause(signal.cause)
                    }
                    case HandoffSignal.OP_END: {
                      if (signal.reason._tag === SinkEndReason.OP_SCHEDULE_END) {
                        return pipe(
                          Ref.get(consumed),
                          Effect.map((bool) =>
                            bool ?
                              core.fromEffect(
                                pipe(
                                  Ref.set(sinkEndReason, SinkEndReason.SchedulEnd),
                                  Effect.zipRight(Ref.set(endAfterEmit, true))
                                )
                              ) :
                              pipe(
                                core.fromEffect(
                                  pipe(
                                    Ref.set(sinkEndReason, SinkEndReason.SchedulEnd),
                                    Effect.zipRight(Ref.set(endAfterEmit, true))
                                  )
                                ),
                                core.flatMap(() => handoffConsumer)
                              )
                          ),
                          channel.unwrap
                        )
                      }
                      return pipe(
                        Ref.set<SinkEndReason.SinkEndReason>(sinkEndReason, signal.reason),
                        Effect.zipRight(Ref.set(endAfterEmit, true)),
                        core.fromEffect
                      )
                    }
                  }
                })
              )
            }),
            channel.unwrap
          )
        const timeout = (lastB: Option.Option<B>): Effect.Effect<R2 | R3, Option.Option<never>, C> =>
          scheduleDriver.next(lastB)
        const scheduledAggregator = (
          sinkFiber: Fiber.RuntimeFiber<E | E2, readonly [Chunk.Chunk<Chunk.Chunk<A | A2>>, B]>,
          scheduleFiber: Fiber.RuntimeFiber<Option.Option<never>, C>,
          scope: Scope.Scope
        ): Channel.Channel<R2 | R3, unknown, unknown, unknown, E | E2, Chunk.Chunk<Either.Either<C, B>>, unknown> => {
          const forkSink = pipe(
            Ref.set(consumed, false),
            Effect.zipRight(Ref.set(endAfterEmit, false)),
            Effect.zipRight(
              pipe(
                handoffConsumer,
                channel.pipeToOrFail(sink.channel),
                core.collectElements,
                channelExecutor.run,
                Effect.forkIn(scope)
              )
            )
          )
          const handleSide = (
            leftovers: Chunk.Chunk<Chunk.Chunk<A | A2>>,
            b: B,
            c: Option.Option<C>
          ): Channel.Channel<R2 | R3, unknown, unknown, unknown, E | E2, Chunk.Chunk<Either.Either<C, B>>, unknown> =>
            pipe(
              Ref.set(sinkLeftovers, Chunk.flatten(leftovers)),
              Effect.zipRight(
                pipe(
                  Ref.get(sinkEndReason),
                  Effect.map((reason) => {
                    switch (reason._tag) {
                      case SinkEndReason.OP_SCHEDULE_END: {
                        return pipe(
                          Effect.tuple(
                            Ref.get(consumed),
                            forkSink,
                            pipe(timeout(Option.some(b)), Effect.forkIn(scope))
                          ),
                          Effect.map(([wasConsumed, sinkFiber, scheduleFiber]) => {
                            const toWrite = pipe(
                              c,
                              Option.match(
                                (): Chunk.Chunk<Either.Either<C, B>> => Chunk.of(Either.right(b)),
                                (c): Chunk.Chunk<Either.Either<C, B>> => Chunk.make(Either.right(b), Either.left(c))
                              )
                            )
                            if (wasConsumed) {
                              return pipe(
                                core.write(toWrite),
                                core.flatMap(() => scheduledAggregator(sinkFiber, scheduleFiber, scope))
                              )
                            }
                            return scheduledAggregator(sinkFiber, scheduleFiber, scope)
                          }),
                          channel.unwrap
                        )
                      }
                      case SinkEndReason.OP_UPSTREAM_END: {
                        return pipe(
                          Ref.get(consumed),
                          Effect.map((wasConsumed) =>
                            wasConsumed ?
                              core.write(Chunk.of<Either.Either<C, B>>(Either.right(b))) :
                              core.unit()
                          ),
                          channel.unwrap
                        )
                      }
                    }
                  })
                )
              ),
              channel.unwrap
            )
          return pipe(
            Fiber.join(sinkFiber),
            Effect.raceWith(
              Fiber.join(scheduleFiber),
              (sinkExit, _) =>
                pipe(
                  Fiber.interrupt(scheduleFiber),
                  Effect.zipRight(pipe(
                    Effect.done(sinkExit),
                    Effect.map(([leftovers, b]) => handleSide(leftovers, b, Option.none()))
                  ))
                ),
              (scheduleExit, _) =>
                pipe(
                  Effect.done(scheduleExit),
                  Effect.matchCauseEffect(
                    (cause) =>
                      pipe(
                        Cause.failureOrCause(cause),
                        Either.match(
                          () =>
                            pipe(
                              handoff,
                              Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(
                                HandoffSignal.end(SinkEndReason.SchedulEnd)
                              ),
                              Effect.forkDaemon,
                              Effect.zipRight(
                                pipe(
                                  Fiber.join(sinkFiber),
                                  Effect.map(([leftovers, b]) => handleSide(leftovers, b, Option.none()))
                                )
                              )
                            ),
                          (cause) =>
                            pipe(
                              handoff,
                              Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(
                                HandoffSignal.halt(cause)
                              ),
                              Effect.forkDaemon,
                              Effect.zipRight(
                                pipe(
                                  Fiber.join(sinkFiber),
                                  Effect.map(([leftovers, b]) => handleSide(leftovers, b, Option.none()))
                                )
                              )
                            )
                        )
                      ),
                    (c) =>
                      pipe(
                        handoff,
                        Handoff.offer<HandoffSignal.HandoffSignal<E | E2, A>>(
                          HandoffSignal.end(SinkEndReason.SchedulEnd)
                        ),
                        Effect.forkDaemon,
                        Effect.zipRight(
                          pipe(
                            Fiber.join(sinkFiber),
                            Effect.map(([leftovers, b]) => handleSide(leftovers, b, Option.some(c)))
                          )
                        )
                      )
                  )
                )
            ),
            channel.unwrap
          )
        }
        return unwrapScoped(
          pipe(
            self.channel,
            core.pipeTo(handoffProducer),
            channelExecutor.run,
            Effect.forkScoped,
            Effect.zipRight(
              pipe(
                handoffConsumer,
                channel.pipeToOrFail(sink.channel),
                core.collectElements,
                channelExecutor.run,
                Effect.forkScoped,
                Effect.flatMap((sinkFiber) =>
                  pipe(
                    Effect.forkScoped(timeout(Option.none())),
                    Effect.flatMap((scheduleFiber) =>
                      pipe(
                        Effect.scope(),
                        Effect.map((scope) =>
                          new StreamImpl(
                            scheduledAggregator(sinkFiber, scheduleFiber, scope)
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      })
    )
  }
)

/** @internal */
export const as = Debug.dual<
  <R, E, A, B>(self: Stream.Stream<R, E, A>, value: B) => Stream.Stream<R, E, B>,
  <B>(value: B) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
>(2, <R, E, A, B>(self: Stream.Stream<R, E, A>, value: B): Stream.Stream<R, E, B> => pipe(self, map(() => value)))

/** @internal */
export const _async = <R, E, A>(
  register: (emit: Emit.Emit<R, E, A, void>) => void,
  outputBuffer = 16
): Stream.Stream<R, E, A> =>
  asyncOption((cb) => {
    register(cb)
    return Option.none()
  }, outputBuffer)

/** @internal */
export const asyncEffect = <R, E, A>(
  register: (emit: Emit.Emit<R, E, A, void>) => Effect.Effect<R, E, unknown>,
  outputBuffer = 16
): Stream.Stream<R, E, A> =>
  pipe(
    Effect.acquireRelease(
      Queue.bounded<Take.Take<E, A>>(outputBuffer),
      (queue) => Queue.shutdown(queue)
    ),
    Effect.flatMap((output) =>
      pipe(
        Effect.runtime<R>(),
        Effect.flatMap((runtime) =>
          pipe(
            register(
              emit.make((k) =>
                pipe(
                  _take.fromPull(k),
                  Effect.flatMap((take) => Queue.offer(output, take)),
                  Effect.asUnit,
                  Runtime.runPromiseExit(runtime)
                ).then((exit) => {
                  if (Exit.isFailure(exit)) {
                    if (!Cause.isInterrupted(exit.cause)) {
                      throw Cause.squash(exit.cause)
                    }
                  }
                })
              )
            ),
            Effect.map(() => {
              const loop: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
                Queue.take(output),
                Effect.flatMap(_take.done),
                Effect.match(
                  (maybeError) =>
                    pipe(
                      core.fromEffect(Queue.shutdown(output)),
                      channel.zipRight(pipe(maybeError, Option.match(core.unit, core.fail)))
                    ),
                  (chunk) => pipe(core.write(chunk), core.flatMap(() => loop))
                ),
                channel.unwrap
              )
              return loop
            })
          )
        )
      )
    ),
    channel.unwrapScoped,
    fromChannel
  )

/** @internal */
export const asyncInterrupt = <R, E, A>(
  register: (
    emit: Emit.Emit<R, E, A, void>
  ) => Either.Either<Effect.Effect<R, never, unknown>, Stream.Stream<R, E, A>>,
  outputBuffer = 16
): Stream.Stream<R, E, A> =>
  pipe(
    Effect.acquireRelease(
      Queue.bounded<Take.Take<E, A>>(outputBuffer),
      (queue) => Queue.shutdown(queue)
    ),
    Effect.flatMap((output) =>
      pipe(
        Effect.runtime<R>(),
        Effect.flatMap((runtime) =>
          pipe(
            Effect.sync(() =>
              register(
                emit.make((k) =>
                  pipe(
                    _take.fromPull(k),
                    Effect.flatMap((take) => Queue.offer(output, take)),
                    Effect.asUnit,
                    Runtime.runPromiseExit(runtime)
                  ).then((exit) => {
                    if (Exit.isFailure(exit)) {
                      if (!Cause.isInterrupted(exit.cause)) {
                        throw Cause.squash(exit.cause)
                      }
                    }
                  })
                )
              )
            ),
            Effect.map(Either.match(
              (canceler) => {
                const loop: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
                  Queue.take(output),
                  Effect.flatMap(_take.done),
                  Effect.match(
                    (maybeError) =>
                      pipe(
                        core.fromEffect(Queue.shutdown(output)),
                        channel.zipRight(pipe(maybeError, Option.match(core.unit, core.fail)))
                      ),
                    (chunk) => pipe(core.write(chunk), core.flatMap(() => loop))
                  ),
                  channel.unwrap
                )
                return pipe(fromChannel(loop), ensuring(canceler))
              },
              (stream) => unwrap(pipe(Queue.shutdown(output), Effect.as(stream)))
            ))
          )
        )
      )
    ),
    unwrapScoped
  )

/** @internal */
export const asyncOption = <R, E, A>(
  register: (emit: Emit.Emit<R, E, A, void>) => Option.Option<Stream.Stream<R, E, A>>,
  outputBuffer = 16
): Stream.Stream<R, E, A> =>
  asyncInterrupt(
    (emit) => pipe(register(emit), Either.fromOption(Effect.unit)),
    outputBuffer
  )

/** @internal */
export const asyncScoped = <R, E, A>(
  register: (
    cb: (effect: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>) => void
  ) => Effect.Effect<R | Scope.Scope, E, unknown>,
  outputBuffer = 16
): Stream.Stream<R, E, A> =>
  pipe(
    Effect.acquireRelease(
      Queue.bounded<Take.Take<E, A>>(outputBuffer),
      (queue) => Queue.shutdown(queue)
    ),
    Effect.flatMap((output) =>
      pipe(
        Effect.runtime<R>(),
        Effect.flatMap((runtime) =>
          pipe(
            register(
              emit.make((k) =>
                pipe(
                  _take.fromPull(k),
                  Effect.flatMap((take) => Queue.offer(output, take)),
                  Effect.asUnit,
                  Runtime.runPromiseExit(runtime)
                ).then((exit) => {
                  if (Exit.isFailure(exit)) {
                    if (!Cause.isInterrupted(exit.cause)) {
                      throw Cause.squash(exit.cause)
                    }
                  }
                })
              )
            ),
            Effect.zipRight(Ref.make(false)),
            Effect.flatMap((ref) =>
              pipe(
                Ref.get(ref),
                Effect.map((isDone) =>
                  isDone ?
                    pull.end() :
                    pipe(
                      Queue.take(output),
                      Effect.flatMap(_take.done),
                      Effect.onError(() =>
                        pipe(
                          Ref.set(ref, true),
                          Effect.zipRight(Queue.shutdown(output))
                        )
                      )
                    )
                )
              )
            )
          )
        )
      )
    ),
    scoped,
    flatMap(repeatEffectChunkOption)
  )

/** @internal */
export const branchAfter = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    n: number,
    f: (input: Chunk.Chunk<A>) => Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    n: number,
    f: (input: Chunk.Chunk<A>) => Stream.Stream<R2, E2, A2>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    n: number,
    f: (input: Chunk.Chunk<A>) => Stream.Stream<R2, E2, A2>
  ) =>
    suspend(() => {
      const bufferring = (
        acc: Chunk.Chunk<A>
      ): Channel.Channel<R | R2, never, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown> =>
        core.readWith(
          (input) => {
            const nextSize = acc.length + input.length
            if (nextSize >= n) {
              const [b1, b2] = pipe(input, Chunk.splitAt(n - acc.length))
              return running(pipe(acc, Chunk.concat(b1)), b2)
            }
            return bufferring(pipe(acc, Chunk.concat(input)))
          },
          core.fail,
          () => running(acc, Chunk.empty())
        )
      const running = (
        prefix: Chunk.Chunk<A>,
        leftover: Chunk.Chunk<A>
      ): Channel.Channel<R | R2, never, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown> =>
        pipe(
          prepend(leftover).channel,
          core.pipeTo(f(prefix).channel)
        )
      return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(bufferring(Chunk.empty<A>()))))
    })
)

/** @internal */
export const broadcast = Debug.dualWithTrace<
  <R, E, A, N extends number>(
    self: Stream.Stream<R, E, A>,
    n: N,
    maximumLag: number
  ) => Effect.Effect<Scope.Scope | R, never, Stream.Stream.DynamicTuple<Stream.Stream<never, E, A>, N>>,
  <N extends number>(
    n: N,
    maximumLag: number
  ) => <R, E, A>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, never, Stream.Stream.DynamicTuple<Stream.Stream<never, E, A>, N>>
>(
  3,
  (trace) =>
    <R, E, A, N extends number>(
      self: Stream.Stream<R, E, A>,
      n: N,
      maximumLag: number
    ): Effect.Effect<R | Scope.Scope, never, Stream.Stream.DynamicTuple<Stream.Stream<never, E, A>, N>> =>
      pipe(
        self,
        broadcastedQueues(n, maximumLag),
        Effect.map((tuple) =>
          tuple.map((queue) =>
            pipe(
              fromQueueWithShutdown(queue),
              flattenTake
            )
          ) as Stream.Stream.DynamicTuple<Stream.Stream<never, E, A>, N>
        )
      ).traced(trace)
)

/** @internal */
export const broadcastDynamic = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    maximumLag: number
  ) => Effect.Effect<Scope.Scope | R, never, Stream.Stream<never, E, A>>,
  (
    maximumLag: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, Stream.Stream<never, E, A>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      maximumLag: number
    ): Effect.Effect<R | Scope.Scope, never, Stream.Stream<never, E, A>> =>
      pipe(
        self,
        broadcastedQueuesDynamic(maximumLag),
        Effect.map((effect) => pipe(scoped(effect), flatMap(fromQueue), flattenTake))
      ).traced(trace)
)

/** @internal */
export const broadcastedQueues = Debug.dualWithTrace<
  <R, E, A, N extends number>(
    self: Stream.Stream<R, E, A>,
    n: N,
    maximumLag: number
  ) => Effect.Effect<Scope.Scope | R, never, Stream.Stream.DynamicTuple<Queue.Dequeue<Take.Take<E, A>>, N>>,
  <N extends number>(
    n: N,
    maximumLag: number
  ) => <R, E, A>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, never, Stream.Stream.DynamicTuple<Queue.Dequeue<Take.Take<E, A>>, N>>
>(
  3,
  (trace) =>
    <R, E, A, N extends number>(
      self: Stream.Stream<R, E, A>,
      n: N,
      maximumLag: number
    ): Effect.Effect<R | Scope.Scope, never, Stream.Stream.DynamicTuple<Queue.Dequeue<Take.Take<E, A>>, N>> =>
      pipe(
        Hub.bounded<Take.Take<E, A>>(maximumLag),
        Effect.flatMap((hub) =>
          pipe(
            Effect.collectAll(Array.from({ length: n }, () => Hub.subscribe(hub))),
            Effect.map((chunk) =>
              Chunk.toReadonlyArray(chunk) as Stream.Stream.DynamicTuple<Queue.Dequeue<Take.Take<E, A>>, N>
            ),
            Effect.tap(() => pipe(self, runIntoHubScoped(hub), Effect.forkScoped))
          )
        )
      ).traced(trace)
)

/** @internal */
export const broadcastedQueuesDynamic = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    maximumLag: number
  ) => Effect.Effect<Scope.Scope | R, never, Effect.Effect<Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>>>,
  (
    maximumLag: number
  ) => <R, E, A>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, never, Effect.Effect<Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      maximumLag: number
    ): Effect.Effect<R | Scope.Scope, never, Effect.Effect<Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>>> =>
      pipe(self, toHub(maximumLag), Effect.map(Hub.subscribe)).traced(trace)
)

/** @internal */
export const buffer = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = toQueueOfElementsCapacity(self, capacity)
  return new StreamImpl(
    pipe(
      queue,
      Effect.map((queue) => {
        const process: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
          core.fromEffect(Queue.take(queue)),
          core.flatMap(Exit.match(
            (cause) =>
              pipe(
                Cause.flipCauseOption(cause),
                Option.match(core.unit, core.failCause)
              ),
            (value) => pipe(core.write(Chunk.of(value)), core.flatMap(() => process))
          ))
        )
        return process
      }),
      channel.unwrapScoped
    )
  )
})

/** @internal */
export const bufferChunks = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = pipe(self, toQueueCapacity(capacity))
  return new StreamImpl(
    pipe(
      queue,
      Effect.map((queue) => {
        const process: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
          core.fromEffect(Queue.take(queue)),
          core.flatMap(_take.match(
            core.unit,
            core.failCause,
            (value) => pipe(core.write(value), core.flatMap(() => process))
          ))
        )
        return process
      }),
      channel.unwrapScoped
    )
  )
})

/** @internal */
export const bufferChunksDropping = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = Effect.acquireRelease(
    Queue.dropping<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>(capacity),
    (queue) => Queue.shutdown(queue)
  )
  return new StreamImpl(bufferSignal(queue, self.channel))
})

/** @internal */
export const bufferChunksSliding = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = Effect.acquireRelease(
    Queue.sliding<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>(capacity),
    (queue) => Queue.shutdown(queue)
  )
  return new StreamImpl(bufferSignal(queue, self.channel))
})

/** @internal */
export const bufferDropping = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = Effect.acquireRelease(
    Queue.dropping<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>(capacity),
    (queue) => Queue.shutdown(queue)
  )
  return new StreamImpl(bufferSignal(queue, rechunk(1)(self).channel))
})

/** @internal */
export const bufferSliding = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number) => Stream.Stream<R, E, A>,
  (capacity: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, capacity: number): Stream.Stream<R, E, A> => {
  const queue = Effect.acquireRelease(
    Queue.sliding<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>(capacity),
    (queue) => Queue.shutdown(queue)
  )
  return new StreamImpl(bufferSignal(queue, pipe(self, rechunk(1)).channel))
})

/** @internal */
export const bufferUnbounded = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A> => {
  const queue = toQueueUnbounded(self)
  return new StreamImpl(
    pipe(
      queue,
      Effect.map((queue) => {
        const process: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
          core.fromEffect(Queue.take(queue)),
          core.flatMap(_take.match(
            core.unit,
            core.failCause,
            (value) => pipe(core.write(value), core.flatMap(() => process))
          ))
        )
        return process
      }),
      channel.unwrapScoped
    )
  )
}

/** @internal */
const bufferSignal = <R, E, A>(
  scoped: Effect.Effect<Scope.Scope, never, Queue.Queue<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>>,
  bufferChannel: Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, void>
): Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> => {
  const producer = (
    queue: Queue.Queue<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>,
    ref: Ref.Ref<Deferred.Deferred<never, void>>
  ): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, never, never, unknown> => {
    const terminate = (take: Take.Take<E, A>): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, never, never, unknown> =>
      pipe(
        Ref.get(ref),
        Effect.tap(Deferred.await),
        Effect.zipRight(Deferred.make<never, void>()),
        Effect.flatMap((deferred) =>
          pipe(
            Queue.offer(queue, [take, deferred] as const),
            Effect.zipRight(Ref.set(ref, deferred)),
            Effect.zipRight(Deferred.await(deferred))
          )
        ),
        Effect.asUnit,
        core.fromEffect
      )
    return core.readWithCause(
      (input: Chunk.Chunk<A>) =>
        pipe(
          Deferred.make<never, void>(),
          Effect.flatMap((deferred) =>
            pipe(
              Queue.offer(queue, [_take.chunk(input), deferred] as const),
              Effect.flatMap((added) => pipe(Ref.set(ref, deferred), Effect.when(() => added)))
            )
          ),
          Effect.asUnit,
          core.fromEffect,
          core.flatMap(() => producer(queue, ref))
        ),
      (error) => terminate(_take.failCause(error)),
      () => terminate(_take.end)
    )
  }
  const consumer = (
    queue: Queue.Queue<readonly [Take.Take<E, A>, Deferred.Deferred<never, void>]>
  ): Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> => {
    const process: Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, void> = pipe(
      core.fromEffect(Queue.take(queue)),
      core.flatMap(([take, deferred]) =>
        pipe(
          core.fromEffect(Deferred.succeed<never, void>(deferred, void 0)),
          channel.zipRight(
            pipe(
              take,
              _take.match(
                core.unit,
                core.failCause,
                (value) => pipe(core.write(value), core.flatMap(() => process))
              )
            )
          )
        )
      )
    )
    return process
  }
  return channel.unwrapScoped(
    pipe(
      scoped,
      Effect.flatMap((queue) =>
        pipe(
          Deferred.make<never, void>(),
          Effect.tap((start) => Deferred.succeed<never, void>(start, void 0)),
          Effect.flatMap((start) =>
            pipe(
              Ref.make(start),
              Effect.flatMap((ref) =>
                pipe(
                  bufferChannel,
                  core.pipeTo(producer(queue, ref)),
                  channelExecutor.runScoped,
                  Effect.forkScoped
                )
              ),
              Effect.as(consumer(queue))
            )
          )
        )
      )
    )
  )
}

/** @internal */
export const catchAll = Debug.dual<
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (error: E) => Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2, A2 | A>,
  <E, R2, E2, A2>(
    f: (error: E) => Stream.Stream<R2, E2, A2>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2, A2 | A>
>(
  2,
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (error: E) => Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E2, A | A2> =>
    pipe(
      self,
      catchAllCause((cause) => pipe(Cause.failureOrCause(cause), Either.match(f, failCause)))
    )
)
/** @internal */
export const catchAllCause = Debug.dual<
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (cause: Cause.Cause<E>) => Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2, A2 | A>,
  <E, R2, E2, A2>(
    f: (cause: Cause.Cause<E>) => Stream.Stream<R2, E2, A2>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2, A2 | A>
>(
  2,
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (cause: Cause.Cause<E>) => Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E2, A | A2> =>
    new StreamImpl<R | R2, E2, A | A2>(pipe(self.channel, core.catchAllCause((cause) => f(cause).channel)))
)

/** @internal */
export const catchSome = Debug.dual<
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (error: E) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E | E2, A2 | A>,
  <E, R2, E2, A2>(
    pf: (error: E) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E | E2, A2 | A>
>(
  2,
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (error: E) => Option.Option<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A | A2> =>
    pipe(self, catchAll((error) => pipe(pf(error), Option.getOrElse(() => fail<E | E2>(error)))))
)

/** @internal */
export const catchSomeCause = Debug.dual<
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (cause: Cause.Cause<E>) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E | E2, A2 | A>,
  <E, R2, E2, A2>(
    pf: (cause: Cause.Cause<E>) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E | E2, A2 | A>
>(
  2,
  <R, A, E, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (cause: Cause.Cause<E>) => Option.Option<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A | A2> =>
    pipe(self, catchAllCause((cause) => pipe(pf(cause), Option.getOrElse(() => failCause<E | E2>(cause)))))
)

/** @internal */
export const changes = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A> =>
  pipe(self, changesWith((x, y) => Equal.equals(y)(x)))

/** @internal */
export const changesWith = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, f: (x: A, y: A) => boolean) => Stream.Stream<R, E, A>,
  <A>(f: (x: A, y: A) => boolean) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, f: (x: A, y: A) => boolean): Stream.Stream<R, E, A> => {
  const writer = (
    last: Option.Option<A>
  ): Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, void> =>
    core.readWithCause(
      (input: Chunk.Chunk<A>) => {
        const [newLast, newChunk] = pipe(
          input,
          Chunk.reduce([last, Chunk.empty<A>()] as const, ([option, outputs], output) => {
            if (Option.isSome(option) && f(option.value, output)) {
              return [Option.some(output), outputs] as const
            }
            return [Option.some(output), pipe(outputs, Chunk.append(output))] as const
          })
        )
        return pipe(core.write(newChunk), core.flatMap(() => writer(newLast)))
      },
      core.failCause,
      core.unit
    )
  return new StreamImpl(pipe(self.channel, core.pipeTo(writer(Option.none()))))
})

/** @internal */
export const changesWithEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (x: A, y: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    f: (x: A, y: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (x: A, y: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const writer = (
      last: Option.Option<A>
    ): Channel.Channel<R | R2, E | E2, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void> =>
      core.readWithCause(
        (input: Chunk.Chunk<A>) =>
          pipe(
            input,
            Effect.reduce([last, Chunk.empty<A>()] as const, ([option, outputs], output) => {
              if (Option.isSome(option)) {
                return pipe(
                  f(option.value, output),
                  Effect.map((bool) =>
                    bool ?
                      [Option.some(output), outputs] as const :
                      [Option.some(output), pipe(outputs, Chunk.append(output))] as const
                  )
                )
              }
              return Effect.succeed(
                [
                  Option.some(output),
                  pipe(outputs, Chunk.append(output))
                ] as const
              )
            }),
            core.fromEffect,
            core.flatMap(([newLast, newChunk]) =>
              pipe(
                core.write(newChunk),
                core.flatMap(() => writer(newLast))
              )
            )
          ),
        core.failCause,
        core.unit
      )
    return new StreamImpl(pipe(self.channel, core.pipeTo(writer(Option.none()))))
  }
)

/** @internal */
export const chunks = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, Chunk.Chunk<A>> =>
  pipe(self, mapChunks(Chunk.of))

/** @internal */
export const chunksWith = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (stream: Stream.Stream<R, E, Chunk.Chunk<A>>) => Stream.Stream<R2, E2, Chunk.Chunk<A2>>
  ) => Stream.Stream<R | R2, E | E2, A2>,
  <R, E, A, R2, E2, A2>(
    f: (stream: Stream.Stream<R, E, Chunk.Chunk<A>>) => Stream.Stream<R2, E2, Chunk.Chunk<A2>>
  ) => (self: Stream.Stream<R, E, A>) => Stream.Stream<R | R2, E | E2, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (stream: Stream.Stream<R, E, Chunk.Chunk<A>>) => Stream.Stream<R2, E2, Chunk.Chunk<A2>>
  ): Stream.Stream<R | R2, E | E2, A2> => flattenChunks(f(chunks(self)))
)

/** @internal */
export const collect = Debug.dual<
  <R, E, A, B>(self: Stream.Stream<R, E, A>, pf: (a: A) => Option.Option<B>) => Stream.Stream<R, E, B>,
  <A, B>(pf: (a: A) => Option.Option<B>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
>(
  2,
  <R, E, A, B>(self: Stream.Stream<R, E, A>, pf: (a: A) => Option.Option<B>): Stream.Stream<R, E, B> =>
    pipe(self, mapChunks(Chunk.filterMap(pf)))
)

/** @internal */
export const collectEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    suspend(() => {
      const loop = (
        iterator: Iterator<A>
      ): Channel.Channel<R | R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A2>, unknown> => {
        const next = iterator.next()
        if (next.done) {
          return core.readWithCause(
            (input) => loop(input[Symbol.iterator]()),
            core.failCause,
            core.succeed
          )
        } else {
          return pipe(
            pf(next.value),
            Option.match(
              () => Effect.sync(() => loop(iterator)),
              Effect.map((a2) => pipe(core.write(Chunk.of(a2)), core.flatMap(() => loop(iterator))))
            ),
            channel.unwrap
          )
        }
      }
      return new StreamImpl(pipe(self.channel, core.pipeTo(loop(Chunk.empty<A>()[Symbol.iterator]()))))
    })
)

/** @internal */
export const collectLeft = <R, E, E2, A>(self: Stream.Stream<R, E, Either.Either<E2, A>>): Stream.Stream<R, E, E2> =>
  pipe(self, collect((either) => Either.isLeft(either) ? Option.some(either.left) : Option.none()))

/** @internal */
export const collectSome = <R, E, A>(self: Stream.Stream<R, E, Option.Option<A>>): Stream.Stream<R, E, A> =>
  pipe(self, collect((option) => Option.isSome(option) ? Option.some(option.value) : Option.none()))

/** @internal */
export const collectSuccess = <R, E, E2, A>(self: Stream.Stream<R, E, Exit.Exit<E2, A>>): Stream.Stream<R, E, A> =>
  pipe(self, collect((exit) => Exit.isSuccess(exit) ? Option.some(exit.value) : Option.none()))

/** @internal */
export const collectRight = <R, E, E2, A>(self: Stream.Stream<R, E, Either.Either<E2, A>>): Stream.Stream<R, E, A> =>
  pipe(self, collect((either) => Either.isRight(either) ? Option.some(either.right) : Option.none()))

/** @internal */
export const collectWhile = <A, A2>(pf: (a: A) => Option.Option<A2>) => {
  return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A2> => {
    const loop: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A2>, unknown> = core.readWith(
      (input: Chunk.Chunk<A>) => {
        const mapped = pipe(input, Chunk.filterMapWhile(pf))
        if (mapped.length === input.length) {
          return pipe(core.write(mapped), core.flatMap(() => loop))
        }
        return core.write(mapped)
      },
      core.fail,
      core.succeed
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
  }
}

/** @internal */
export const collectWhileLeft = <R, E, E2, A>(
  self: Stream.Stream<R, E, Either.Either<E2, A>>
): Stream.Stream<R, E, E2> =>
  pipe(self, collectWhile((either) => Either.isLeft(either) ? Option.some(either.left) : Option.none()))

/** @internal */
export const collectWhileSome = <R, E, A>(self: Stream.Stream<R, E, Option.Option<A>>): Stream.Stream<R, E, A> =>
  pipe(self, collectWhile((option) => Option.isSome(option) ? Option.some(option.value) : Option.none()))

/** @internal */
export const collectWhileRight = <R, E, E2, A>(
  self: Stream.Stream<R, E, Either.Either<E2, A>>
): Stream.Stream<R, E, A> =>
  pipe(self, collectWhile((either) => Either.isRight(either) ? Option.some(either.right) : Option.none()))

/** @internal */
export const collectWhileSuccess = <R, E, E2, A>(self: Stream.Stream<R, E, Exit.Exit<E2, A>>): Stream.Stream<R, E, A> =>
  pipe(self, collectWhile((exit) => Exit.isSuccess(exit) ? Option.some(exit.value) : Option.none()))

/** @internal */
export const collectWhileEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    pf: (a: A) => Option.Option<Effect.Effect<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    suspend(() => {
      const loop = (
        iterator: Iterator<A>
      ): Channel.Channel<R | R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A2>, unknown> => {
        const next = iterator.next()
        if (next.done) {
          return core.readWithCause(
            (input) => loop(input[Symbol.iterator]()),
            core.failCause,
            core.succeed
          )
        } else {
          return pipe(
            pf(next.value),
            Option.match(
              () => Effect.succeed(core.unit()),
              Effect.map((a2) => pipe(core.write(Chunk.of(a2)), core.flatMap(() => loop(iterator))))
            ),
            channel.unwrap
          )
        }
      }
      return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop(Chunk.empty<A>()[Symbol.iterator]()))))
    })
)

/** @internal */
export const combine = Debug.dual<
  <R, R2, E2, A2, S, R3, E, A, R4, R5, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    s: S,
    f: (
      s: S,
      pullLeft: Effect.Effect<R3, Option.Option<E>, A>,
      pullRight: Effect.Effect<R4, Option.Option<E2>, A2>
    ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E2 | E>, readonly [A3, S]>>
  ) => Stream.Stream<R2 | R3 | R4 | R5 | R, E2 | E, A3>,
  <R2, E2, A2, S, R3, E, A, R4, R5, A3>(
    that: Stream.Stream<R2, E2, A2>,
    s: S,
    f: (
      s: S,
      pullLeft: Effect.Effect<R3, Option.Option<E>, A>,
      pullRight: Effect.Effect<R4, Option.Option<E2>, A2>
    ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E2 | E>, readonly [A3, S]>>
  ) => <R>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R3 | R4 | R5 | R, E2 | E, A3>
>(4, <R, R2, E2, A2, S, R3, E, A, R4, R5, A3>(
  self: Stream.Stream<R, E, A>,
  that: Stream.Stream<R2, E2, A2>,
  s: S,
  f: (
    s: S,
    pullLeft: Effect.Effect<R3, Option.Option<E>, A>,
    pullRight: Effect.Effect<R4, Option.Option<E2>, A2>
  ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E | E2>, readonly [A3, S]>>
): Stream.Stream<R | R2 | R3 | R4 | R5, E | E2, A3> => {
  const producer = <Err, Elem>(
    handoff: Handoff.Handoff<Exit.Exit<Option.Option<Err>, Elem>>,
    latch: Handoff.Handoff<void>
  ): Channel.Channel<R, Err, Elem, unknown, never, never, unknown> =>
    pipe(
      core.fromEffect(Handoff.take(latch)),
      channel.zipRight(core.readWithCause(
        (input) =>
          pipe(
            core.fromEffect(pipe(
              handoff,
              Handoff.offer<Exit.Exit<Option.Option<Err>, Elem>>(Exit.succeed(input))
            )),
            core.flatMap(() => producer(handoff, latch))
          ),
        (cause) =>
          core.fromEffect(pipe(
            handoff,
            Handoff.offer<Exit.Exit<Option.Option<Err>, Elem>>(Exit.failCause(pipe(cause, Cause.map(Option.some))))
          )),
        () =>
          pipe(
            core.fromEffect(
              pipe(
                handoff,
                Handoff.offer<Exit.Exit<Option.Option<Err>, Elem>>(Exit.fail(Option.none()))
              )
            ),
            core.flatMap(() => producer(handoff, latch))
          )
      ))
    )
  return new StreamImpl(
    channel.unwrapScoped(
      Effect.gen(function*($) {
        const left = yield* $(Handoff.make<Exit.Exit<Option.Option<E>, A>>())
        const right = yield* $(Handoff.make<Exit.Exit<Option.Option<E2>, A2>>())
        const latchL = yield* $(Handoff.make<void>())
        const latchR = yield* $(Handoff.make<void>())
        yield* $(
          pipe(
            self.channel,
            channel.concatMap(channel.writeChunk),
            core.pipeTo(producer(left, latchL)),
            channelExecutor.runScoped,
            Effect.forkScoped
          )
        )
        yield* $(
          pipe(
            that.channel,
            channel.concatMap(channel.writeChunk),
            core.pipeTo(producer(right, latchR)),
            channelExecutor.runScoped,
            Effect.forkScoped
          )
        )
        const pullLeft = pipe(
          latchL,
          Handoff.offer<void>(void 0),
          Effect.zipRight(pipe(Handoff.take(left), Effect.flatMap(Effect.done)))
        )
        const pullRight = pipe(
          latchR,
          Handoff.offer<void>(void 0),
          Effect.zipRight(pipe(Handoff.take(right), Effect.flatMap(Effect.done)))
        )
        return unfoldEffect(s, (s) =>
          pipe(
            f(s, pullLeft, pullRight),
            Effect.flatMap((exit) => Effect.unsome(Effect.done(exit)))
          )).channel
      })
    )
  )
})

/** @internal */
export const combineChunks = Debug.dual<
  <R, R2, E2, A2, S, R3, E, A, R4, R5, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    s: S,
    f: (
      s: S,
      pullLeft: Effect.Effect<R3, Option.Option<E>, Chunk.Chunk<A>>,
      pullRight: Effect.Effect<R4, Option.Option<E2>, Chunk.Chunk<A2>>
    ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E2 | E>, readonly [Chunk.Chunk<A3>, S]>>
  ) => Stream.Stream<R2 | R3 | R4 | R5 | R, E2 | E, A3>,
  <R2, E2, A2, S, R3, E, A, R4, R5, A3>(
    that: Stream.Stream<R2, E2, A2>,
    s: S,
    f: (
      s: S,
      pullLeft: Effect.Effect<R3, Option.Option<E>, Chunk.Chunk<A>>,
      pullRight: Effect.Effect<R4, Option.Option<E2>, Chunk.Chunk<A2>>
    ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E2 | E>, readonly [Chunk.Chunk<A3>, S]>>
  ) => <R>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R3 | R4 | R5 | R, E2 | E, A3>
>(4, <R, R2, E2, A2, S, R3, E, A, R4, R5, A3>(
  self: Stream.Stream<R, E, A>,
  that: Stream.Stream<R2, E2, A2>,
  s: S,
  f: (
    s: S,
    pullLeft: Effect.Effect<R3, Option.Option<E>, Chunk.Chunk<A>>,
    pullRight: Effect.Effect<R4, Option.Option<E2>, Chunk.Chunk<A2>>
  ) => Effect.Effect<R5, never, Exit.Exit<Option.Option<E | E2>, readonly [Chunk.Chunk<A3>, S]>>
): Stream.Stream<R | R2 | R3 | R4 | R5, E | E2, A3> => {
  const producer = <Err, Elem>(
    handoff: Handoff.Handoff<Take.Take<Err, Elem>>,
    latch: Handoff.Handoff<void>
  ): Channel.Channel<R, Err, Chunk.Chunk<Elem>, unknown, never, never, unknown> =>
    pipe(
      core.fromEffect(Handoff.take(latch)),
      channel.zipRight(
        core.readWithCause(
          (input) =>
            pipe(
              core.fromEffect(pipe(
                handoff,
                Handoff.offer<Take.Take<Err, Elem>>(_take.chunk(input))
              )),
              core.flatMap(() => producer(handoff, latch))
            ),
          (cause) =>
            core.fromEffect(pipe(
              handoff,
              Handoff.offer<Take.Take<Err, Elem>>(_take.failCause(cause))
            )),
          () =>
            pipe(
              core.fromEffect(pipe(
                handoff,
                Handoff.offer<Take.Take<Err, Elem>>(_take.end)
              )),
              core.flatMap(() => producer(handoff, latch))
            )
        )
      )
    )
  return new StreamImpl(
    pipe(
      Effect.tuple(
        Handoff.make<Take.Take<E, A>>(),
        Handoff.make<Take.Take<E2, A2>>(),
        Handoff.make<void>(),
        Handoff.make<void>()
      ),
      Effect.tap(([left, _, latchL]) =>
        pipe(
          self.channel,
          core.pipeTo(producer(left, latchL)),
          channelExecutor.runScoped,
          Effect.forkScoped
        )
      ),
      Effect.tap(([_, right, __, latchR]) =>
        pipe(
          that.channel,
          core.pipeTo(producer(right, latchR)),
          channelExecutor.runScoped,
          Effect.forkScoped
        )
      ),
      Effect.map(([left, right, latchL, latchR]) => {
        const pullLeft = pipe(
          latchL,
          Handoff.offer<void>(void 0),
          Effect.zipRight(
            pipe(
              Handoff.take(left),
              Effect.flatMap(_take.done)
            )
          )
        )
        const pullRight = pipe(
          latchR,
          Handoff.offer<void>(void 0),
          Effect.zipRight(
            pipe(
              Handoff.take(right),
              Effect.flatMap(_take.done)
            )
          )
        )
        return unfoldChunkEffect(s, (s) =>
          pipe(
            f(s, pullLeft, pullRight),
            Effect.flatMap((exit) => Effect.unsome(Effect.done(exit)))
          )).channel
      }),
      channel.unwrapScoped
    )
  )
})

/** @internal */
export const concat = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> =>
    new StreamImpl<R | R2, E | E2, A | A2>(pipe(self.channel, channel.zipRight(that.channel)))
)

/** @internal */
export const concatAll = <R, E, A>(streams: Chunk.Chunk<Stream.Stream<R, E, A>>): Stream.Stream<R, E, A> =>
  suspend(() => pipe(streams, Chunk.reduce(empty as Stream.Stream<R, E, A>, (x, y) => concat(y)(x))))

/** @internal */
export const cross = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, readonly [A, A2]> => pipe(self, crossWith(that, (a, a2) => [a, a2]))
)

/** @internal */
export const crossLeft = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A> => pipe(self, crossWith(that, (a, _) => a))
)

/** @internal */
export const crossRight = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A2> => pipe(self, crossWith(that, (_, a2) => a2))
)

/** @internal */
export const crossWith = Debug.dual<
  <R, E, R2, E2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, B>,
    f: (a: A, b: B) => C
  ) => Stream.Stream<R2 | R, E2 | E, C>,
  <R2, E2, B, A, C>(
    that: Stream.Stream<R2, E2, B>,
    f: (a: A, b: B) => C
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, C>
>(
  3,
  <R, E, R2, E2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, B>,
    f: (a: A, b: B) => C
  ): Stream.Stream<R | R2, E | E2, C> => pipe(self, flatMap((a) => pipe(that, map((b) => f(a, b)))))
)

/** @internal */
export const debounce = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration) => Stream.Stream<R, E, A>,
  (duration: Duration.Duration) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration): Stream.Stream<R, E, A> =>
  pipe(
    singleProducerAsyncInput.make<never, Chunk.Chunk<A>, unknown>(),
    Effect.flatMap((input) =>
      Effect.transplant<never, never, Stream.Stream<R, E, A>>((grafter) =>
        pipe(
          Handoff.make<HandoffSignal.HandoffSignal<never, A>>(),
          Effect.map((handoff) => {
            const enqueue = (last: Chunk.Chunk<A>): Effect.Effect<
              never,
              never,
              Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown>
            > =>
              pipe(
                Clock.sleep(duration),
                Effect.as(last),
                Effect.fork,
                grafter,
                Effect.map((fiber) => consumer(DebounceState.previous(fiber)))
              )
            const producer: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, never, unknown> = core
              .readWithCause(
                (input: Chunk.Chunk<A>) =>
                  pipe(
                    Chunk.last(input),
                    Option.match(
                      () => producer,
                      (last) =>
                        pipe(
                          core.fromEffect(
                            pipe(
                              handoff,
                              Handoff.offer<HandoffSignal.HandoffSignal<E, A>>(
                                HandoffSignal.emit(Chunk.of(last))
                              )
                            )
                          ),
                          core.flatMap(() => producer)
                        )
                    )
                  ),
                (cause) =>
                  core.fromEffect(
                    pipe(handoff, Handoff.offer<HandoffSignal.HandoffSignal<E, A>>(HandoffSignal.halt(cause)))
                  ),
                () =>
                  core.fromEffect(
                    pipe(
                      handoff,
                      Handoff.offer<HandoffSignal.HandoffSignal<E, A>>(HandoffSignal.end(SinkEndReason.UpstreamEnd))
                    )
                  )
              )
            const consumer = (
              state: DebounceState.DebounceState<never, A>
            ): Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown> => {
              switch (state._tag) {
                case DebounceState.OP_NOT_STARTED: {
                  return pipe(
                    Handoff.take(handoff),
                    Effect.map((signal) => {
                      switch (signal._tag) {
                        case HandoffSignal.OP_EMIT: {
                          return channel.unwrap(enqueue(signal.elements))
                        }
                        case HandoffSignal.OP_HALT: {
                          return core.failCause(signal.cause)
                        }
                        case HandoffSignal.OP_END: {
                          return core.unit()
                        }
                      }
                    }),
                    channel.unwrap
                  )
                }
                case DebounceState.OP_PREVIOUS: {
                  return pipe(
                    Fiber.join(state.fiber),
                    Effect.raceWith(
                      Handoff.take(handoff),
                      (leftExit, current) =>
                        pipe(
                          leftExit,
                          Exit.match(
                            (cause) => pipe(Fiber.interrupt(current), Effect.as(core.failCause(cause))),
                            (chunk) =>
                              Effect.succeed(
                                pipe(core.write(chunk), core.flatMap(() => consumer(DebounceState.current(current))))
                              )
                          )
                        ),
                      (rightExit, previous) =>
                        pipe(
                          rightExit,
                          Exit.match(
                            (cause) => pipe(Fiber.interrupt(previous), Effect.as(core.failCause(cause))),
                            (signal) => {
                              switch (signal._tag) {
                                case HandoffSignal.OP_EMIT: {
                                  return pipe(Fiber.interrupt(previous), Effect.zipRight(enqueue(signal.elements)))
                                }
                                case HandoffSignal.OP_HALT: {
                                  return pipe(Fiber.interrupt(previous), Effect.as(core.failCause(signal.cause)))
                                }
                                case HandoffSignal.OP_END: {
                                  return pipe(
                                    Fiber.join(previous),
                                    Effect.map((chunk) => pipe(core.write(chunk), channel.zipRight(core.unit())))
                                  )
                                }
                              }
                            }
                          )
                        )
                    ),
                    channel.unwrap
                  )
                }
                case DebounceState.OP_CURRENT: {
                  return pipe(
                    Fiber.join(state.fiber),
                    Effect.map((signal) => {
                      switch (signal._tag) {
                        case HandoffSignal.OP_EMIT: {
                          return channel.unwrap(enqueue(signal.elements))
                        }
                        case HandoffSignal.OP_HALT: {
                          return core.failCause(signal.cause)
                        }
                        case HandoffSignal.OP_END: {
                          return core.unit()
                        }
                      }
                    }),
                    channel.unwrap
                  )
                }
              }
            }
            const debounceChannel: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> =
              pipe(
                channel.fromInput(input),
                core.pipeTo(producer),
                channelExecutor.run,
                Effect.forkScoped,
                Effect.as(pipe(
                  consumer(DebounceState.notStarted),
                  core.embedInput<E, Chunk.Chunk<A>, unknown>(input)
                )),
                channel.unwrapScoped
              )
            return new StreamImpl(pipe(self.channel, core.pipeTo(debounceChannel)))
          })
        )
      )
    ),
    unwrap
  ))

/** @internal */
export const die = (defect: unknown): Stream.Stream<never, never, never> => fromEffect(Effect.die(defect))

/** @internal */
export const dieSync = (evaluate: LazyArg<unknown>): Stream.Stream<never, never, never> =>
  fromEffect(Effect.dieSync(evaluate))

/** @internal */
export const dieMessage = (message: string): Stream.Stream<never, never, never> =>
  fromEffect(Effect.dieMessage(message))

/** @internal */
export const distributedWith = Debug.dual<
  <R, E, N extends number, A>(
    self: Stream.Stream<R, E, A>,
    n: N,
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Stream.Stream.DynamicTuple<Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>, N>
  >,
  <N extends number, A>(
    n: N,
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Stream.Stream.DynamicTuple<Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>, N>
  >
>(
  4,
  <R, E, N extends number, A>(
    self: Stream.Stream<R, E, A>,
    n: N,
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
  ): Effect.Effect<
    R | Scope.Scope,
    never,
    Stream.Stream.DynamicTuple<Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>, N>
  > =>
    pipe(
      Deferred.make<never, (a: A) => Effect.Effect<never, never, Predicate<number>>>(),
      Effect.flatMap((deferred) =>
        pipe(
          self,
          distributedWithDynamic(
            maximumLag,
            (a) => Effect.flatMap(Deferred.await(deferred), (f) => f(a))
          ),
          Effect.flatMap((next) =>
            pipe(
              Chunk.range(0, n - 1),
              Chunk.map((id) => Effect.map(next, ([key, queue]) => [[key, id], queue] as const)),
              Effect.collectAll,
              Effect.flatMap((entries) => {
                const [mappings, queues] = pipe(
                  entries,
                  Chunk.reduceRight(
                    [
                      new Map<number, number>(),
                      Chunk.empty<Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>>()
                    ] as const,
                    ([mappings, queues], [mapping, queue]) =>
                      [
                        mappings.set(mapping[0], mapping[1]),
                        pipe(queues, Chunk.prepend(queue))
                      ] as const
                  )
                )
                return pipe(
                  Deferred.succeed(deferred, (a: A) =>
                    Effect.map(decide(a), (f) => (key: number) => pipe(f(mappings.get(key)!)))),
                  Effect.as(
                    Array.from(queues) as Stream.Stream.DynamicTuple<Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>, N>
                  )
                )
              })
            )
          )
        )
      )
    )
)

/** @internal */
const distributedWithDynamicId = { ref: 0 }

const newDistributedWithDynamicId = () => {
  const current = distributedWithDynamicId.ref
  distributedWithDynamicId.ref = current + 1
  return current
}

/** @internal */
export const distributedWithDynamic = Debug.dualWithTrace<
  <R, E, A, _>(
    self: Stream.Stream<R, E, A>,
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
  >,
  <E, A, _>(
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
  ) => <R>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
  >
>(
  3,
  (trace) =>
    <R, E, A, _>(
      self: Stream.Stream<R, E, A>,
      maximumLag: number,
      decide: (a: A) => Effect.Effect<never, never, Predicate<number>>
    ): Effect.Effect<
      R | Scope.Scope,
      never,
      Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
    > => distributedWithDynamicCallback(self, maximumLag, decide, () => Effect.unit()).traced(trace)
)

export const distributedWithDynamicCallback = Debug.dualWithTrace<
  <R, E, A, _>(
    self: Stream.Stream<R, E, A>,
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>,
    done: (exit: Exit.Exit<Option.Option<E>, never>) => Effect.Effect<never, never, _>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
  >,
  <E, A, _>(
    maximumLag: number,
    decide: (a: A) => Effect.Effect<never, never, Predicate<number>>,
    done: (exit: Exit.Exit<Option.Option<E>, never>) => Effect.Effect<never, never, _>
  ) => <R>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<
    Scope.Scope | R,
    never,
    Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
  >
>(
  4,
  (trace) =>
    <R, E, A, _>(
      self: Stream.Stream<R, E, A>,
      maximumLag: number,
      decide: (a: A) => Effect.Effect<never, never, Predicate<number>>,
      done: (exit: Exit.Exit<Option.Option<E>, never>) => Effect.Effect<never, never, _>
    ): Effect.Effect<
      R | Scope.Scope,
      never,
      Effect.Effect<never, never, readonly [number, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>]>
    > =>
      pipe(
        Effect.acquireRelease(
          Ref.make<Map<number, Queue.Queue<Exit.Exit<Option.Option<E>, A>>>>(new Map()),
          (ref, _) =>
            pipe(Ref.get(ref), Effect.flatMap((queues) => pipe(queues.values(), Effect.forEach(Queue.shutdown))))
        ),
        Effect.flatMap((queuesRef) =>
          Effect.gen(function*($) {
            const offer = (a: A): Effect.Effect<never, never, void> =>
              pipe(
                decide(a),
                Effect.flatMap((shouldProcess) =>
                  pipe(
                    Ref.get(queuesRef),
                    Effect.flatMap((queues) =>
                      pipe(
                        queues.entries(),
                        Effect.reduce(Chunk.empty<number>(), (acc, [id, queue]) => {
                          if (shouldProcess(id)) {
                            return pipe(
                              Queue.offer(queue, Exit.succeed(a)),
                              Effect.matchCauseEffect(
                                (cause) =>
                                  // Ignore all downstream queues that were shut
                                  // down and remove them later
                                  Cause.isInterrupted(cause) ?
                                    Effect.succeed(pipe(acc, Chunk.prepend(id))) :
                                    Effect.failCause(cause),
                                () => Effect.succeed(acc)
                              )
                            )
                          }
                          return Effect.succeed(acc)
                        }),
                        Effect.flatMap((ids) => {
                          if (Chunk.isNonEmpty(ids)) {
                            return pipe(
                              Ref.update(queuesRef, (map) => {
                                for (const id of ids) {
                                  map.delete(id)
                                }
                                return map
                              })
                            )
                          }
                          return Effect.unit()
                        })
                      )
                    )
                  )
                ),
                Effect.asUnit
              )
            const queuesLock = yield* $(Effect.makeSemaphore(1))
            const newQueue = yield* $(
              Ref.make<Effect.Effect<never, never, readonly [number, Queue.Queue<Exit.Exit<Option.Option<E>, A>>]>>(
                pipe(
                  Queue.bounded<Exit.Exit<Option.Option<E>, A>>(maximumLag),
                  Effect.flatMap((queue) => {
                    const id = newDistributedWithDynamicId()
                    return pipe(
                      Ref.update(queuesRef, (map) => map.set(id, queue)),
                      Effect.as([id, queue] as const)
                    )
                  })
                )
              )
            )
            const finalize = (endTake: Exit.Exit<Option.Option<E>, never>): Effect.Effect<never, never, void> =>
              // Make sure that no queues are currently being added
              queuesLock.withPermits(1)(
                pipe(
                  Ref.set(
                    newQueue,
                    pipe(
                      // All newly created queues should end immediately
                      Queue.bounded<Exit.Exit<Option.Option<E>, A>>(1),
                      Effect.tap((queue) => Queue.offer(queue, endTake)),
                      Effect.flatMap((queue) => {
                        const id = newDistributedWithDynamicId()
                        return pipe(
                          Ref.update(queuesRef, (map) => map.set(id, queue)),
                          Effect.as([id, queue] as const)
                        )
                      })
                    )
                  ),
                  Effect.zipRight(
                    pipe(
                      Ref.get(queuesRef),
                      Effect.flatMap((map) =>
                        pipe(
                          Chunk.fromIterable(map.values()),
                          Effect.forEach((queue) =>
                            pipe(
                              Queue.offer(queue, endTake),
                              Effect.catchSomeCause((cause) =>
                                Cause.isInterrupted(cause) ? Option.some(Effect.unit()) : Option.none()
                              )
                            )
                          )
                        )
                      )
                    )
                  ),
                  Effect.zipRight(done(endTake)),
                  Effect.asUnit
                )
              )
            yield* $(pipe(
              self,
              runForEachScoped(offer),
              Effect.matchCauseEffect(
                (cause) => finalize(Exit.failCause(pipe(cause, Cause.map(Option.some)))),
                () => finalize(Exit.fail(Option.none()))
              ),
              Effect.forkScoped
            ))
            return queuesLock.withPermits(1)(
              Effect.flatten(Ref.get(newQueue))
            )
          })
        )
      ).traced(trace)
)

/** @internal */
export const done = <E, A>(exit: Exit.Exit<E, A>): Stream.Stream<never, E, A> => fromEffect(Effect.done(exit))

/** @internal */
export const drain = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, never> =>
  new StreamImpl(channel.drain(self.channel))

/** @internal */
export const drainFork = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      fromEffect(Deferred.make<E2, never>()),
      flatMap((backgroundDied) =>
        pipe(
          scoped(
            pipe(
              that,
              runForEachScoped(() => Effect.unit()),
              Effect.catchAllCause((cause) => Deferred.failCause(backgroundDied, cause)),
              Effect.forkScoped
            )
          ),
          crossRight(pipe(self, interruptWhenDeferred(backgroundDied)))
        )
      )
    )
)

/** @internal */
export const drop = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, n: number) => Stream.Stream<R, E, A>,
  (n: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, n: number): Stream.Stream<R, E, A> => {
  const loop = (r: number): Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<A>, unknown> =>
    core.readWith(
      (input: Chunk.Chunk<A>) => {
        const dropped = pipe(input, Chunk.drop(r))
        const leftover = Math.max(0, r - input.length)
        const more = Chunk.isEmpty(input) || leftover > 0
        if (more) {
          return loop(leftover)
        }
        return pipe(
          core.write(dropped),
          channel.zipRight(channel.identityChannel<never, Chunk.Chunk<A>, unknown>())
        )
      },
      core.fail,
      core.unit
    )
  return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop(n))))
})

/** @internal */
export const dropRight = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, n: number) => Stream.Stream<R, E, A>,
  (n: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, n: number): Stream.Stream<R, E, A> => {
  if (n <= 0) {
    return identityStream()
  }
  return suspend(() => {
    const queue = new RingBuffer<A>(n)
    const reader: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, void> = core.readWith(
      (input: Chunk.Chunk<A>) => {
        const outputs = pipe(
          input,
          Chunk.filterMap((elem) => {
            const head = queue.head()
            queue.put(elem)
            return head
          })
        )
        return pipe(core.write(outputs), core.flatMap(() => reader))
      },
      core.fail,
      core.unit
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(reader)))
  })
})

/** @internal */
export const dropUntil = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => Stream.Stream<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A> =>
    pipe(self, dropWhile((a) => !predicate(a)), drop(1))
)

/** @internal */
export const dropUntilEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> = core.readWith(
      (input: Chunk.Chunk<A>) =>
        pipe(
          input,
          Effect.dropUntil(predicate),
          Effect.map((leftover) => {
            const more = Chunk.isEmpty(leftover)
            if (more) {
              return core.suspend(() => loop)
            }
            return pipe(
              core.write(leftover),
              channel.zipRight(channel.identityChannel<E | E2, Chunk.Chunk<A>, unknown>())
            )
          }),
          channel.unwrap
        ),
      core.fail,
      core.unit
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
  }
)

/** @internal */
export const dropWhile = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => Stream.Stream<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A> => {
  const loop: Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<A>, unknown> = core.readWith(
    (input: Chunk.Chunk<A>) => {
      const output = pipe(input, Chunk.dropWhile(predicate))
      if (Chunk.isEmpty(output)) {
        return core.suspend(() => loop)
      }
      return pipe(core.write(output), channel.zipRight(channel.identityChannel<never, Chunk.Chunk<A>, unknown>()))
    },
    core.fail,
    core.succeedNow
  )
  return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
})

/** @internal */
export const dropWhileEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> = core.readWith(
      (input: Chunk.Chunk<A>) =>
        pipe(
          input,
          Effect.dropWhile(predicate),
          Effect.map((leftover) => {
            const more = Chunk.isEmpty(leftover)
            if (more) {
              return core.suspend(() => loop)
            }
            return pipe(
              core.write(leftover),
              channel.zipRight(channel.identityChannel<E | E2, Chunk.Chunk<A>, unknown>())
            )
          }),
          channel.unwrap
        ),
      core.fail,
      core.unit
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
  }
)

/** @internal */
export const either = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, never, Either.Either<E, A>> =>
  pipe(self, map(Either.right), catchAll((error) => make(Either.left(error))))

/** @internal */
export const empty: Stream.Stream<never, never, never> = new StreamImpl(core.write(Chunk.empty()))

/** @internal */
export const ensuring = Debug.dual<
  <R, E, A, R2, _>(self: Stream.Stream<R, E, A>, finalizer: Effect.Effect<R2, never, _>) => Stream.Stream<R2 | R, E, A>,
  <R2, _>(
    finalizer: Effect.Effect<R2, never, _>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, E, A, R2, _>(self: Stream.Stream<R, E, A>, finalizer: Effect.Effect<R2, never, _>): Stream.Stream<R | R2, E, A> =>
    new StreamImpl(pipe(self.channel, channel.ensuring(finalizer)))
)

/** @internal */
export const context = <R>(): Stream.Stream<R, never, Context.Context<R>> => fromEffect(Effect.context<R>())

/** @internal */
export const contextWith = <R, A>(f: (env: Context.Context<R>) => A): Stream.Stream<R, never, A> =>
  pipe(context<R>(), map(f))

/** @internal */
export const contextWithEffect = <R0, R, E, A>(
  f: (env: Context.Context<R0>) => Effect.Effect<R, E, A>
): Stream.Stream<R0 | R, E, A> => pipe(context<R0>(), mapEffect(f))

/** @internal */
export const contextWithStream = <R0, R, E, A>(
  f: (env: Context.Context<R0>) => Stream.Stream<R, E, A>
): Stream.Stream<R0 | R, E, A> => pipe(context<R0>(), flatMap(f))

/** @internal */
export const execute = <R, E, _>(effect: Effect.Effect<R, E, _>): Stream.Stream<R, E, never> =>
  drain(fromEffect(effect))

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
export const filter = Debug.dual<{
  <R, E, A, B extends A>(self: Stream.Stream<R, E, A>, refinement: Refinement<A, B>): Stream.Stream<R, E, B>
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A>
}, {
  <A, B extends A>(refinement: Refinement<A, B>): <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
  <A>(predicate: Predicate<A>): <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
}>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => mapChunks(self, Chunk.filter(predicate)))

/** @internal */
export const filterEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop = (
      iterator: Iterator<A>
    ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> => {
      const next = iterator.next()
      if (next.done) {
        return core.readWithCause(
          (input) => loop(input[Symbol.iterator]()),
          core.failCause,
          core.succeed
        )
      } else {
        return pipe(
          f(next.value),
          Effect.map((bool) =>
            bool ?
              pipe(core.write(Chunk.of(next.value)), core.flatMap(() => loop(iterator))) :
              loop(iterator)
          ),
          channel.unwrap
        )
      }
    }
    return new StreamImpl(
      core.suspend(() => pipe(self.channel, core.pipeTo(loop(Chunk.empty<A>()[Symbol.iterator]()))))
    )
  }
)

/** @internal */
export const finalizer = <R, _>(finalizer: Effect.Effect<R, never, _>): Stream.Stream<R, never, void> =>
  acquireRelease(Effect.unit(), () => finalizer)

/** @internal */
export const find = Debug.dual<{
  <R, E, A, B extends A>(self: Stream.Stream<R, E, A>, refinement: Refinement<A, B>): Stream.Stream<R, E, B>
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A>
}, {
  <A, B extends A>(refinement: Refinement<A, B>): <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
  <A>(predicate: Predicate<A>): <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
}>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A> => {
  const loop: Channel.Channel<R, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, unknown> = core.readWith(
    (input: Chunk.Chunk<A>) =>
      pipe(
        input,
        Chunk.findFirst(predicate),
        Option.match(
          () => loop,
          (n) => core.write(Chunk.of(n))
        )
      ),
    core.fail,
    core.unit
  )
  return new StreamImpl(pipe(self.channel, core.pipeTo(loop)))
})

/** @internal */
export const findEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> = core.readWith(
      (input: Chunk.Chunk<A>) =>
        pipe(
          input,
          Effect.find(predicate),
          Effect.map(Option.match(
            () => loop,
            (n) => core.write(Chunk.of(n))
          )),
          channel.unwrap
        ),
      core.fail,
      core.unit
    )
    return new StreamImpl(pipe(self.channel, core.pipeTo(loop)))
  }
)

/** @internal */
export const flatMap = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Stream.Stream<R2, E2, A2>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.concatMap((as) =>
          pipe(
            as,
            Chunk.map((a) => f(a).channel),
            Chunk.reduce(
              core.unit() as Channel.Channel<R2, unknown, unknown, unknown, E2, Chunk.Chunk<A2>, unknown>,
              (left, right) => pipe(left, channel.zipRight(right))
            )
          )
        )
      )
    )
)

/** @internal */
export const flatMapPar = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ): Stream.Stream<R | R2, E | E2, A2> => flatMapParBuffer(self, f, n, 16)
)

/** @internal */
export const flatMapParBuffer = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  4,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ): Stream.Stream<R | R2, E | E2, A2> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.concatMap(channel.writeChunk),
        channel.mergeMapBuffer((out) => f(out).channel, n, bufferSize)
      )
    )
)

/** @internal */
export const flatMapParSwitch = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number
  ): Stream.Stream<R | R2, E | E2, A2> => flatMapParSwitchBuffer(self, f, n, 16)
)

/** @internal */
export const flatMapParSwitchBuffer = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  4,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Stream.Stream<R2, E2, A2>,
    n: number,
    bufferSize: number
  ): Stream.Stream<R | R2, E | E2, A2> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.concatMap(channel.writeChunk),
        channel.mergeMapBufferStrategy(
          (out) => f(out).channel,
          n,
          bufferSize,
          MergeStrategy.BufferSliding
        )
      )
    )
)

/** @internal */
export const flatten = <R, E, R2, E2, A>(
  self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => pipe(self, flatMap(identity))

/** @internal */
export const flattenChunks = <R, E, A>(self: Stream.Stream<R, E, Chunk.Chunk<A>>): Stream.Stream<R, E, A> => {
  const flatten: Channel.Channel<never, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown, E, Chunk.Chunk<A>, unknown> = core
    .readWithCause(
      (chunks: Chunk.Chunk<Chunk.Chunk<A>>) => pipe(channel.writeChunk(chunks), core.flatMap(() => flatten)),
      core.failCause,
      core.unit
    )
  return new StreamImpl(pipe(self.channel, core.pipeTo(flatten)))
}

/** @internal */
export const flattenEffect = <R, E, R2, E2, A>(
  self: Stream.Stream<R, E, Effect.Effect<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => pipe(self, mapEffect(identity))

/** @internal */
export const flattenExit = <R, E, E2, A>(self: Stream.Stream<R, E, Exit.Exit<E2, A>>): Stream.Stream<R, E | E2, A> =>
  pipe(self, mapEffect(Effect.done))

/** @internal */
export const flattenExitOption = <R, E, E2, A>(
  self: Stream.Stream<R, E, Exit.Exit<Option.Option<E2>, A>>
): Stream.Stream<R, E | E2, A> => {
  const processChunk = (
    chunk: Chunk.Chunk<Exit.Exit<Option.Option<E2>, A>>,
    cont: Channel.Channel<R, E, Chunk.Chunk<Exit.Exit<Option.Option<E2>, A>>, unknown, E | E2, Chunk.Chunk<A>, unknown>
  ) => {
    const [toEmit, rest] = pipe(chunk, Chunk.splitWhere((exit) => !Exit.isSuccess(exit)))
    const next = pipe(
      Chunk.head(rest),
      Option.match(
        () => cont,
        Exit.match(
          (cause) => pipe(Cause.flipCauseOption(cause), Option.match(core.unit, core.failCause)),
          core.unit
        )
      )
    )
    return pipe(
      core.write(pipe(
        toEmit,
        Chunk.filterMap((exit) =>
          Exit.isSuccess(exit) ?
            Option.some(exit.value) :
            Option.none()
        )
      )),
      core.flatMap(() => next)
    )
  }
  const process: Channel.Channel<
    R,
    E,
    Chunk.Chunk<Exit.Exit<Option.Option<E2>, A>>,
    unknown,
    E | E2,
    Chunk.Chunk<A>,
    unknown
  > = core.readWithCause(
    (chunk: Chunk.Chunk<Exit.Exit<Option.Option<E2>, A>>) => processChunk(chunk, process),
    (cause) => core.failCause<E | E2>(cause),
    () => core.unit()
  )
  return new StreamImpl(pipe(self.channel, core.pipeTo(process)))
}

/** @internal */
export const flattenIterables = <R, E, A>(self: Stream.Stream<R, E, Iterable<A>>): Stream.Stream<R, E, A> =>
  pipe(self, map(Chunk.fromIterable), flattenChunks)

/** @internal */
export const flattenPar = Debug.dual<
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    n: number
  ) => Stream.Stream<R | R2, E | E2, A>,
  (
    n: number
  ) => <R, E, R2, E2, A>(self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>) => Stream.Stream<R | R2, E | E2, A>
>(
  2,
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    n: number
  ): Stream.Stream<R | R2, E | E2, A> => flattenParBuffer(self, n, 16)
)

/** @internal */
export const flattenParBuffer = Debug.dual<
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    n: number,
    bufferSize: number
  ) => Stream.Stream<R | R2, E | E2, A>,
  (
    n: number,
    bufferSize: number
  ) => <R, E, R2, E2, A>(self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>) => Stream.Stream<R | R2, E | E2, A>
>(
  3,
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    n: number,
    bufferSize: number
  ): Stream.Stream<R | R2, E | E2, A> => flatMapParBuffer(self, identity, n, bufferSize)
)

/** @internal */
export const flattenParUnbounded = <R, E, R2, E2, A>(
  self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => flattenParUnboundedBuffer(self, 16)

/** @internal */
export const flattenParUnboundedBuffer = Debug.dual<
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    bufferSize: number
  ) => Stream.Stream<R | R2, E | E2, A>,
  (
    bufferSize: number
  ) => <R, E, R2, E2, A>(self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>) => Stream.Stream<R | R2, E | E2, A>
>(
  2,
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, Stream.Stream<R2, E2, A>>,
    bufferSize: number
  ): Stream.Stream<R | R2, E | E2, A> => flatMapParBuffer(self, identity, Number.POSITIVE_INFINITY, bufferSize)
)

/** @internal */
export const flattenTake = <R, E, E2, A>(self: Stream.Stream<R, E, Take.Take<E2, A>>): Stream.Stream<R, E | E2, A> =>
  flattenChunks(flattenExitOption(pipe(self, map((take) => take.exit))))

/** @internal */
export const forever = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, A> =>
  new StreamImpl(channel.repeated(self.channel))

/** @internal */
export const fromChannel = <R, E, A>(
  channel: Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown>
): Stream.Stream<R, E, A> => new StreamImpl(channel)

/** @internal */
export const fromChunk = <A>(chunk: Chunk.Chunk<A>): Stream.Stream<never, never, A> =>
  new StreamImpl(Chunk.isEmpty(chunk) ? core.unit() : core.write(chunk))

/** @internal */
export const fromChunkHub = <A>(hub: Hub.Hub<Chunk.Chunk<A>>): Stream.Stream<never, never, A> =>
  pipe(scoped(Hub.subscribe(hub)), flatMap(fromChunkQueue))

/** @internal */
export const fromChunkHubScoped = <A>(
  hub: Hub.Hub<Chunk.Chunk<A>>
): Effect.Effect<Scope.Scope, never, Stream.Stream<never, never, A>> =>
  pipe(Hub.subscribe(hub), Effect.map(fromChunkQueue))

/** @internal */
export const fromChunkHubWithShutdown = <A>(hub: Hub.Hub<Chunk.Chunk<A>>): Stream.Stream<never, never, A> =>
  pipe(fromChunkHub(hub), ensuring(Hub.shutdown(hub)))

/** @internal */
export const fromChunkHubScopedWithShutdown = <A>(
  hub: Hub.Hub<Chunk.Chunk<A>>
): Effect.Effect<Scope.Scope, never, Stream.Stream<never, never, A>> =>
  pipe(fromChunkHubScoped(hub), Effect.map(ensuring(Hub.shutdown(hub))))

/** @internal */
export const fromChunkQueue = <A>(queue: Queue.Dequeue<Chunk.Chunk<A>>): Stream.Stream<never, never, A> =>
  pipe(
    Queue.take(queue),
    Effect.catchAllCause((cause) =>
      pipe(
        Queue.isShutdown(queue),
        Effect.flatMap((isShutdown) =>
          isShutdown && Cause.isInterrupted(cause) ?
            pull.end() :
            pull.failCause(cause)
        )
      )
    ),
    repeatEffectChunkOption
  )

/** @internal */
export const fromChunkQueueWithShutdown = <A>(queue: Queue.Dequeue<Chunk.Chunk<A>>): Stream.Stream<never, never, A> =>
  pipe(fromChunkQueue(queue), ensuring(Queue.shutdown(queue)))

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
      Effect.match(Option.match(core.unit, core.fail), (a) => core.write(Chunk.of(a))),
      channel.unwrap
    )
  )

/** @internal */
export const fromHub = <A>(hub: Hub.Hub<A>, maxChunkSize = DefaultChunkSize): Stream.Stream<never, never, A> =>
  pipe(
    scoped(Hub.subscribe(hub)),
    flatMap((queue) => fromQueue(queue, maxChunkSize))
  )

/** @internal */
export const fromHubScoped = Debug.methodWithTrace((trace) =>
  <A>(
    hub: Hub.Hub<A>,
    maxChunkSize = DefaultChunkSize
  ): Effect.Effect<Scope.Scope, never, Stream.Stream<never, never, A>> =>
    pipe(
      Effect.suspendSucceed(() =>
        pipe(
          Hub.subscribe(hub),
          Effect.map((queue) => fromQueueWithShutdown(queue, maxChunkSize))
        )
      )
    ).traced(trace)
)

/** @internal */
export const fromHubWithShutdown = <A>(
  hub: Hub.Hub<A>,
  maxChunkSize = DefaultChunkSize
): Stream.Stream<never, never, A> => pipe(fromHub(hub, maxChunkSize), ensuring(Hub.shutdown(hub)))

/** @internal */
export const fromHubScopedWithShutdown = Debug.methodWithTrace((trace) =>
  <A>(
    hub: Hub.Hub<A>,
    maxChunkSize = DefaultChunkSize
  ): Effect.Effect<Scope.Scope, never, Stream.Stream<never, never, A>> =>
    pipe(
      fromHubScoped(hub, maxChunkSize),
      Effect.map(ensuring(Hub.shutdown(hub)))
    ).traced(trace)
)

/** @internal */
export const fromIterable = <A>(iterable: Iterable<A>): Stream.Stream<never, never, A> =>
  suspend(() =>
    Chunk.isChunk(iterable) ?
      fromChunk(iterable) :
      fromIteratorSucceed(iterable[Symbol.iterator]())
  )

/** @internal */
export const fromIterableEffect = <R, E, A>(
  effect: Effect.Effect<R, E, Iterable<A>>
): Stream.Stream<R, E, A> => pipe(effect, Effect.map(fromIterable), unwrap)

/** @internal */
export const fromIteratorSucceed = <A>(
  iterator: Iterator<A>,
  maxChunkSize = DefaultChunkSize
): Stream.Stream<never, never, A> => {
  return pipe(
    Effect.sync(() => {
      let builder: Array<A> = []
      const loop = (
        iterator: Iterator<A>
      ): Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown> =>
        pipe(
          Effect.sync(() => {
            let next: IteratorResult<A, any> = iterator.next()
            if (maxChunkSize === 1) {
              if (next.done) {
                return core.unit()
              }
              return pipe(
                core.write(Chunk.of(next.value)),
                core.flatMap(() => loop(iterator))
              )
            }
            builder = []
            let count = 0
            while (count < maxChunkSize && !next.done) {
              builder.push(next.value)
              next = iterator.next()
              count = count + 1
            }
            if (count > 0) {
              return pipe(
                core.write(Chunk.unsafeFromArray(builder)),
                core.flatMap(() => loop(iterator))
              )
            }
            return core.unit()
          }),
          channel.unwrap
        )
      return new StreamImpl(loop(iterator))
    }),
    unwrap
  )
}

/** @internal */
export const fromPull = <R, R2, E, A>(
  effect: Effect.Effect<R | Scope.Scope, never, Effect.Effect<R2, Option.Option<E>, Chunk.Chunk<A>>>
): Stream.Stream<R | R2, E, A> => pipe(effect, Effect.map(repeatEffectChunkOption), unwrapScoped)

/** @internal */
export const fromQueue = <A>(
  queue: Queue.Dequeue<A>,
  maxChunkSize = DefaultChunkSize
): Stream.Stream<never, never, A> =>
  pipe(
    Queue.takeBetween(queue, 1, maxChunkSize),
    Effect.catchAllCause((cause) =>
      pipe(
        Queue.isShutdown(queue),
        Effect.flatMap((isShutdown) =>
          isShutdown && Cause.isInterrupted(cause) ?
            pull.end() :
            pull.failCause(cause)
        )
      )
    ),
    repeatEffectChunkOption
  )

/** @internal */
export const fromQueueWithShutdown = <A>(
  queue: Queue.Dequeue<A>,
  maxChunkSize = DefaultChunkSize
): Stream.Stream<never, never, A> => pipe(fromQueue(queue, maxChunkSize), ensuring(Queue.shutdown(queue)))

/** @internal */
export const fromSchedule = <R, A>(schedule: Schedule.Schedule<R, unknown, A>): Stream.Stream<R, never, A> =>
  pipe(
    Schedule.driver(schedule),
    Effect.map((driver) => repeatEffectOption(driver.next(void 0))),
    unwrap
  )

/** @internal */
export const groupAdjacentBy = Debug.dual<
  <R, E, A, K>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => K
  ) => Stream.Stream<R, E, readonly [K, Chunk.NonEmptyChunk<A>]>,
  <A, K>(
    f: (a: A) => K
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, readonly [K, Chunk.NonEmptyChunk<A>]>
>(
  2,
  <R, E, A, K>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => K
  ): Stream.Stream<R, E, readonly [K, Chunk.NonEmptyChunk<A>]> => {
    type Output = readonly [K, Chunk.NonEmptyChunk<A>]
    const go = (
      input: Chunk.Chunk<A>,
      state: Option.Option<Output>
    ): readonly [Chunk.Chunk<Output>, Option.Option<Output>] =>
      pipe(
        input,
        Chunk.reduce([Chunk.empty<Output>(), state] as const, ([outputs, option], a) => {
          if (Option.isSome(option)) {
            const key = option.value[0]
            const aggregated = option.value[1]
            const key2 = f(a)
            if (Equal.equals(key2)(key)) {
              return [
                outputs,
                Option.some([key, pipe(aggregated, Chunk.append(a)) as Chunk.NonEmptyChunk<A>] as const)
              ] as const
            }
            return [
              pipe(outputs, Chunk.append(option.value)),
              Option.some([key2, Chunk.of(a)] as const)
            ] as const
          }
          return [outputs, Option.some([f(a), Chunk.of(a)] as const)] as const
        })
      )
    const chunkAdjacent = (
      buffer: Option.Option<Output>
    ): Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<Output>, unknown> =>
      core.readWithCause(
        (input: Chunk.Chunk<A>) => {
          const [outputs, newBuffer] = go(input, buffer)
          return pipe(core.write(outputs), core.flatMap(() => chunkAdjacent(newBuffer)))
        },
        core.failCause,
        () => pipe(buffer, Option.match(core.unit, (output) => core.write(Chunk.of(output))))
      )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(chunkAdjacent(Option.none()))))
  }
)

/** @internal */
export const grouped = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  (chunkSize: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number): Stream.Stream<R, E, Chunk.Chunk<A>> =>
    pipe(self, rechunk(chunkSize), chunks)
)

/** @internal */
export const groupedWithin = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    chunkSize: number,
    duration: Duration.Duration
  ) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  (
    chunkSize: number,
    duration: Duration.Duration
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(
  3,
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    chunkSize: number,
    duration: Duration.Duration
  ): Stream.Stream<R, E, Chunk.Chunk<A>> =>
    pipe(self, aggregateWithin(_sink.collectAllN(chunkSize), Schedule.spaced(duration)))
)

/** @internal */
export const haltWhen = Debug.dual<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, _>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, _>(
    effect: Effect.Effect<R2, E2, _>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, _>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const writer = (
      fiber: Fiber.Fiber<E2, _>
    ): Channel.Channel<R2, E | E2, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void> =>
      pipe(
        Fiber.poll(fiber),
        Effect.map(Option.match(
          () =>
            core.readWith(
              (input: Chunk.Chunk<A>) => pipe(core.write(input), core.flatMap(() => writer(fiber))),
              core.fail,
              core.unit
            ),
          Exit.match<E2, _, Channel.Channel<R2, E | E2, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void>>(
            core.failCause,
            core.unit
          )
        )),
        channel.unwrap
      )
    return new StreamImpl(
      pipe(
        Effect.forkScoped(effect),
        Effect.map((fiber) => pipe(self.channel, core.pipeTo(writer(fiber)))),
        channel.unwrapScoped
      )
    )
  }
)

/** @internal */
export const haltAfter = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration) => Stream.Stream<R, E, A>,
  (duration: Duration.Duration) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration): Stream.Stream<R, E, A> =>
    pipe(self, haltWhen(Clock.sleep(duration)))
)

/** @internal */
export const haltWhenDeferred = Debug.dual<
  <R, E, A, E2, _>(self: Stream.Stream<R, E, A>, deferred: Deferred.Deferred<E2, _>) => Stream.Stream<R, E2 | E, A>,
  <E2, _>(deferred: Deferred.Deferred<E2, _>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2 | E, A>
>(
  2,
  <R, E, A, E2, _>(self: Stream.Stream<R, E, A>, deferred: Deferred.Deferred<E2, _>): Stream.Stream<R, E | E2, A> => {
    const writer: Channel.Channel<R, E | E2, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void> = pipe(
      Deferred.poll(deferred),
      Effect.map(Option.match(
        () =>
          core.readWith(
            (input: Chunk.Chunk<A>) => pipe(core.write(input), core.flatMap(() => writer)),
            core.fail,
            core.unit
          ),
        (effect) => pipe(effect, Effect.match(core.fail, core.unit), channel.unwrap)
      )),
      channel.unwrap
    )
    return new StreamImpl(pipe(self.channel, core.pipeTo(writer)))
  }
)

/** @internal */
export const identityStream = <R, E, A>(): Stream.Stream<R, E, A> =>
  new StreamImpl(
    channel.identityChannel() as Channel.Channel<never, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown>
  )

/** @internal */
export const interleave = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => pipe(self, interleaveWith(that, forever(make(true, false))))
)

/** @internal */
export const interleaveWith = Debug.dual<
  <R, E, A, R2, E2, A2, R3, E3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    decider: Stream.Stream<R3, E3, boolean>
  ) => Stream.Stream<R2 | R3 | R, E2 | E3 | E, A2 | A>,
  <R2, E2, A2, R3, E3>(
    that: Stream.Stream<R2, E2, A2>,
    decider: Stream.Stream<R3, E3, boolean>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R3 | R, E2 | E3 | E, A2 | A>
>(
  3,
  <R, E, A, R2, E2, A2, R3, E3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    decider: Stream.Stream<R3, E3, boolean>
  ): Stream.Stream<R | R2 | R3, E | E2 | E3, A | A2> => {
    const producer = (
      handoff: Handoff.Handoff<Take.Take<E | E2 | E3, A | A2>>
    ): Channel.Channel<R | R2 | R3, E | E2 | E3, A | A2, unknown, never, never, void> =>
      core.readWithCause(
        (value: A | A2) =>
          pipe(
            handoff,
            Handoff.offer<Take.Take<E | E2 | E3, A | A2>>(_take.of(value)),
            core.fromEffect,
            core.flatMap(() => producer(handoff))
          ),
        (cause) =>
          pipe(
            handoff,
            Handoff.offer<Take.Take<E | E2 | E3, A | A2>>(_take.failCause(cause)),
            core.fromEffect
          ),
        () =>
          pipe(
            handoff,
            Handoff.offer<Take.Take<E | E2 | E3, A | A2>>(_take.end),
            core.fromEffect
          )
      )
    return new StreamImpl(
      channel.unwrapScoped(
        pipe(
          Handoff.make<Take.Take<E | E2 | E3, A | A2>>(),
          Effect.zip(Handoff.make<Take.Take<E | E2, A | A2>>()),
          Effect.tap(([left]) =>
            pipe(
              self.channel,
              channel.concatMap(channel.writeChunk),
              core.pipeTo(producer(left)),
              channelExecutor.runScoped,
              Effect.forkScoped
            )
          ),
          Effect.tap(([_, right]) =>
            pipe(
              that.channel,
              channel.concatMap(channel.writeChunk),
              core.pipeTo(producer(right)),
              channelExecutor.runScoped,
              Effect.forkScoped
            )
          ),
          Effect.map(([left, right]) => {
            const process = (
              leftDone: boolean,
              rightDone: boolean
            ): Channel.Channel<R, E | E2 | E3, boolean, unknown, E | E2 | E3, Chunk.Chunk<A | A2>, void> =>
              core.readWithCause(
                (bool: boolean) => {
                  if (bool && !leftDone) {
                    return pipe(
                      core.fromEffect(Handoff.take(left)),
                      core.flatMap(_take.match(
                        () => rightDone ? core.unit() : process(true, rightDone),
                        core.failCause,
                        (chunk) => pipe(core.write(chunk), core.flatMap(() => process(leftDone, rightDone)))
                      ))
                    )
                  }
                  if (!bool && !rightDone) {
                    return pipe(
                      core.fromEffect(Handoff.take(right)),
                      core.flatMap(_take.match(
                        () => leftDone ? core.unit() : process(leftDone, true),
                        core.failCause,
                        (chunk) => pipe(core.write(chunk), core.flatMap(() => process(leftDone, rightDone)))
                      ))
                    )
                  }
                  return process(leftDone, rightDone)
                },
                core.failCause,
                core.unit
              )
            return pipe(
              decider.channel,
              channel.concatMap(channel.writeChunk),
              core.pipeTo(process(false, false))
            )
          })
        )
      )
    )
  }
)

/** @internal */
export const intersperse = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, element: A2) => Stream.Stream<R, E, A2 | A>,
  <A2>(element: A2) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2 | A>
>(2, <R, E, A, A2>(self: Stream.Stream<R, E, A>, element: A2): Stream.Stream<R, E, A | A2> =>
  new StreamImpl(
    pipe(
      self.channel,
      channel.pipeToOrFail(
        core.suspend(() => {
          const writer = (
            isFirst: boolean
          ): Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A | A2>, unknown> =>
            core.readWithCause(
              (chunk: Chunk.Chunk<A>) => {
                const builder: Array<A | A2> = []
                let flagResult = isFirst
                for (const output of chunk) {
                  if (flagResult) {
                    flagResult = false
                    builder.push(output)
                  } else {
                    builder.push(element)
                    builder.push(output)
                  }
                }
                return pipe(
                  core.write(Chunk.unsafeFromArray(builder)),
                  core.flatMap(() => writer(flagResult))
                )
              },
              core.failCause,
              core.unit
            )
          return writer(true)
        })
      )
    )
  ))

/** @internal */
export const intersperseAffixes = Debug.dual<
  <R, E, A, A2, A3, A4>(
    self: Stream.Stream<R, E, A>,
    start: A2,
    middle: A3,
    end: A4
  ) => Stream.Stream<R, E, A2 | A3 | A4 | A>,
  <A2, A3, A4>(
    start: A2,
    middle: A3,
    end: A4
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2 | A3 | A4 | A>
>(
  4,
  <R, E, A, A2, A3, A4>(
    self: Stream.Stream<R, E, A>,
    start: A2,
    middle: A3,
    end: A4
  ): Stream.Stream<R, E, A | A2 | A3 | A4> =>
    pipe(
      make(start),
      concat(pipe(self, intersperse(middle))),
      concat(make(end))
    )
)

/** @internal */
export const interruptAfter = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration) => Stream.Stream<R, E, A>,
  (duration: Duration.Duration) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration): Stream.Stream<R, E, A> =>
    pipe(self, interruptWhen(Clock.sleep(duration)))
)

/** @internal */
export const interruptWhen = Debug.dual<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, _>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, _>(
    effect: Effect.Effect<R2, E2, _>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, _>
  ): Stream.Stream<R | R2, E | E2, A> => new StreamImpl(pipe(self.channel, channel.interruptWhen(effect)))
)

/** @internal */
export const interruptWhenDeferred = Debug.dual<
  <R, E, A, E2, _>(self: Stream.Stream<R, E, A>, deferred: Deferred.Deferred<E2, _>) => Stream.Stream<R, E2 | E, A>,
  <E2, _>(deferred: Deferred.Deferred<E2, _>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2 | E, A>
>(
  2,
  <R, E, A, E2, _>(self: Stream.Stream<R, E, A>, deferred: Deferred.Deferred<E2, _>): Stream.Stream<R, E | E2, A> =>
    new StreamImpl(pipe(self.channel, channel.interruptWhenDeferred(deferred)))
)

/** @internal */
export const iterate = <A>(value: A, next: (value: A) => A): Stream.Stream<never, never, A> =>
  unfold(value, (a) => Option.some([a, next(a)] as const))

/** @internal */
export const log = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.log(message))

/** @internal */
export const logDebug = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logDebug(message))

/** @internal */
export const logDebugCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logDebugCause(cause))

/** @internal */
export const logDebugCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logDebugCauseMessage(message, cause))

/** @internal */
export const logError = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logError(message))

/** @internal */
export const logErrorCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logErrorCause(cause))

/** @internal */
export const logErrorCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logErrorCauseMessage(message, cause))

/** @internal */
export const logFatal = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logFatal(message))

/** @internal */
export const logFatalCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logFatalCause(cause))

/** @internal */
export const logFatalCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logFatalCauseMessage(message, cause))

/** @internal */
export const logInfo = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logInfo(message))

/** @internal */
export const logInfoCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logInfoCause(cause))

/** @internal */
export const logInfoCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logInfoCauseMessage(message, cause))

/** @internal */
export const logWarning = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logWarning(message))

/** @internal */
export const logWarningCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logWarningCause(cause))

/** @internal */
export const logWarningCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logWarningCauseMessage(message, cause))

/** @internal */
export const logTrace = (message: string): Stream.Stream<never, never, void> => fromEffect(Effect.logTrace(message))

/** @internal */
export const logTraceCause = <E>(cause: Cause.Cause<E>): Stream.Stream<never, never, void> =>
  fromEffect(Effect.logTraceCause(cause))

/** @internal */
export const logTraceCauseMessage = <E>(
  message: string,
  cause: Cause.Cause<E>
): Stream.Stream<never, never, void> => fromEffect(Effect.logTraceCauseMessage(message, cause))

/** @internal */
export const make = <As extends Array<any>>(...as: As): Stream.Stream<never, never, As[number]> => fromIterable(as)

/** @internal */
export const map = Debug.dual<
  <R, E, A, B>(self: Stream.Stream<R, E, A>, f: (a: A) => B) => Stream.Stream<R, E, B>,
  <A, B>(f: (a: A) => B) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
>(
  2,
  <R, E, A, B>(self: Stream.Stream<R, E, A>, f: (a: A) => B): Stream.Stream<R, E, B> =>
    new StreamImpl(pipe(self.channel, channel.mapOut(Chunk.map(f))))
)

/** @internal */
export const mapAccum = Debug.dual<
  <R, E, S, A, A2>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => readonly [S, A2]) => Stream.Stream<R, E, A2>,
  <S, A, A2>(
    s: S,
    f: (s: S, a: A) => readonly [S, A2]
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2>
>(
  3,
  <R, E, S, A, A2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => readonly [S, A2]
  ): Stream.Stream<R, E, A2> => {
    const accumulator = (s: S): Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A2>, void> =>
      core.readWith(
        (input: Chunk.Chunk<A>) => {
          const [nextS, chunk] = pipe(input, Chunk.mapAccum(s, f))
          return pipe(core.write(chunk), core.flatMap(() => accumulator(nextS)))
        },
        core.fail,
        core.unit
      )
    return new StreamImpl(pipe(self.channel, core.pipeTo(accumulator(s))))
  }
)

/** @internal */
export const mapAccumEffect = Debug.dual<
  <R, E, S, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, readonly [S, A2]>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <S, A, R2, E2, A2>(
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, readonly [S, A2]>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, S, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, readonly [S, A2]>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    suspend(() => {
      const accumulator = (
        s: S
      ): Channel.Channel<R | R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A2>, unknown> =>
        core.readWith(
          (input: Chunk.Chunk<A>) =>
            pipe(
              Effect.suspendSucceed(() => {
                const outputs: Array<A2> = []
                const emit = (output: A2) =>
                  Effect.sync(() => {
                    outputs.push(output)
                  })
                return pipe(
                  input,
                  Effect.reduce(s, (s, a) =>
                    pipe(
                      f(s, a),
                      Effect.flatMap(([s, a]) => pipe(emit(a), Effect.as(s)))
                    )),
                  Effect.match(
                    (error) => {
                      if (outputs.length !== 0) {
                        return pipe(core.write(Chunk.unsafeFromArray(outputs)), channel.zipRight(core.fail(error)))
                      }
                      return core.fail(error)
                    },
                    (s) => pipe(core.write(Chunk.unsafeFromArray(outputs)), core.flatMap(() => accumulator(s)))
                  )
                )
              }),
              channel.unwrap
            ),
          core.fail,
          core.unit
        )
      return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(accumulator(s))))
    })
)

/** @internal */
export const mapBoth = Debug.dual<
  <R, E, E2, A, A2>(self: Stream.Stream<R, E, A>, f: (e: E) => E2, g: (a: A) => A2) => Stream.Stream<R, E2, A2>,
  <E, E2, A, A2>(f: (e: E) => E2, g: (a: A) => A2) => <R>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A2>
>(
  3,
  <R, E, E2, A, A2>(self: Stream.Stream<R, E, A>, f: (e: E) => E2, g: (a: A) => A2): Stream.Stream<R, E2, A2> =>
    pipe(self, mapError(f), map(g))
)

/** @internal */
export const mapChunks = Debug.dual<
  <R, E, A, B>(self: Stream.Stream<R, E, A>, f: (chunk: Chunk.Chunk<A>) => Chunk.Chunk<B>) => Stream.Stream<R, E, B>,
  <A, B>(f: (chunk: Chunk.Chunk<A>) => Chunk.Chunk<B>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, B>
>(
  2,
  <R, E, A, B>(self: Stream.Stream<R, E, A>, f: (chunk: Chunk.Chunk<A>) => Chunk.Chunk<B>): Stream.Stream<R, E, B> =>
    new StreamImpl(pipe(self.channel, channel.mapOut(f)))
)

/** @internal */
export const mapChunksEffect = Debug.dual<
  <R, E, A, R2, E2, B>(
    self: Stream.Stream<R, E, A>,
    f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, Chunk.Chunk<B>>
  ) => Stream.Stream<R2 | R, E2 | E, B>,
  <A, R2, E2, B>(
    f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, Chunk.Chunk<B>>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, B>
>(
  2,
  <R, E, A, R2, E2, B>(
    self: Stream.Stream<R, E, A>,
    f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, Chunk.Chunk<B>>
  ): Stream.Stream<R | R2, E | E2, B> => new StreamImpl(pipe(self.channel, channel.mapOutEffect(f)))
)

/** @internal */
export const mapConcat = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, f: (a: A) => Iterable<A2>) => Stream.Stream<R, E, A2>,
  <A, A2>(f: (a: A) => Iterable<A2>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, f: (a: A) => Iterable<A2>): Stream.Stream<R, E, A2> =>
    pipe(self, mapConcatChunk((a) => Chunk.fromIterable(f(a))))
)

/** @internal */
export const mapConcatChunk = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, f: (a: A) => Chunk.Chunk<A2>) => Stream.Stream<R, E, A2>,
  <A, A2>(f: (a: A) => Chunk.Chunk<A2>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, f: (a: A) => Chunk.Chunk<A2>): Stream.Stream<R, E, A2> =>
    pipe(self, mapChunks(Chunk.flatMap(f)))
)

/** @internal */
export const mapConcatChunkEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, Chunk.Chunk<A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Effect.Effect<R2, E2, Chunk.Chunk<A2>>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, Chunk.Chunk<A2>>
  ): Stream.Stream<R | R2, E | E2, A2> => pipe(self, mapEffect(f), mapConcatChunk(identity))
)

/** @internal */
export const mapConcatEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, Iterable<A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Effect.Effect<R2, E2, Iterable<A2>>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, Iterable<A2>>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    pipe(self, mapEffect((a) => pipe(f(a), Effect.map(Chunk.fromIterable))), mapConcatChunk(identity))
)

/** @internal */
export const mapEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Effect.Effect<R2, E2, A2>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    suspend(() => {
      const loop = (
        iterator: Iterator<A>
      ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A2>, unknown> => {
        const next = iterator.next()
        if (next.done) {
          return core.readWithCause(
            (elem) => loop(elem[Symbol.iterator]()),
            core.failCause,
            core.succeed
          )
        } else {
          return pipe(
            f(next.value),
            Effect.map((a2) =>
              pipe(
                core.write(Chunk.of(a2)),
                core.flatMap(() => loop(iterator))
              )
            ),
            channel.unwrap
          )
        }
      }
      return new StreamImpl(pipe(
        self.channel,
        core.pipeTo(loop(Chunk.empty<A>()[Symbol.iterator]()))
      ))
    })
)

/** @internal */
export const mapEffectPar = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ): Stream.Stream<R | R2, E | E2, A2> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.concatMap(channel.writeChunk),
        channel.mapOutEffectPar(f, n),
        channel.mapOut(Chunk.of)
      )
    )
)

/** @internal */
export const mapEffectParUnordered = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, A2>,
    n: number
  ): Stream.Stream<R | R2, E | E2, A2> => flatMapPar(self, (a) => fromEffect(f(a)), n)
)

/** @internal */
export const mapError = Debug.dual<
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, f: (error: E) => E2) => Stream.Stream<R, E2, A>,
  <E, E2>(f: (error: E) => E2) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A>
>(
  2,
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, f: (error: E) => E2): Stream.Stream<R, E2, A> =>
    new StreamImpl(pipe(self.channel, channel.mapError(f)))
)

/** @internal */
export const mapErrorCause = Debug.dual<
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, f: (cause: Cause.Cause<E>) => Cause.Cause<E2>) => Stream.Stream<R, E2, A>,
  <E, E2>(
    f: (cause: Cause.Cause<E>) => Cause.Cause<E2>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A>
>(
  2,
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, f: (cause: Cause.Cause<E>) => Cause.Cause<E2>): Stream.Stream<R, E2, A> =>
    new StreamImpl(pipe(self.channel, channel.mapErrorCause(f)))
)

/** @internal */
export const merge = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => mergeHaltStrategy(self, that, HaltStrategy.Both)
)

/** @internal */
export const mergeHaltStrategy = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    strategy: HaltStrategy.HaltStrategy
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>,
    strategy: HaltStrategy.HaltStrategy
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    strategy: HaltStrategy.HaltStrategy
  ): Stream.Stream<R | R2, E | E2, A | A2> => mergeWithHaltStrategy(self, that, identity, identity, strategy)
)

/** @internal */
export const mergeAll = (n: number, bufferSize = 16) => {
  return <R, E, A>(...streams: Array<Stream.Stream<R, E, A>>): Stream.Stream<R, E, A> =>
    pipe(fromIterable(streams), flattenParBuffer(n, bufferSize))
}

/** @internal */
export const mergeAllUnbounded = (bufferSize = 16) => {
  return <R, E, A>(...streams: Array<Stream.Stream<R, E, A>>): Stream.Stream<R, E, A> =>
    pipe(fromIterable(streams), flattenParBuffer(Number.POSITIVE_INFINITY, bufferSize))
}

/** @internal */
export const mergeHaltEither = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => mergeHaltStrategy(self, that, haltStrategy.Either)
)

/** @internal */
export const mergeHaltLeft = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => mergeHaltStrategy(self, that, haltStrategy.Left)
)

/** @internal */
export const mergeHaltRight = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => mergeHaltStrategy(self, that, haltStrategy.Right)
)

/** @internal */
export const mergeEither = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, Either.Either<A, A2>>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, Either.Either<A, A2>>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, Either.Either<A, A2>> => mergeWith(self, that, Either.left, Either.right)
)

/** @internal */
export const mergeLeft = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A> => pipe(self, merge(drain(that)))
)

/** @internal */
export const mergeRight = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A2> => pipe(drain(self), merge(that))
)

/** @internal */
export const mergeWith = Debug.dual<
  <R, E, R2, E2, A2, A, A3, A4>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4
  ) => Stream.Stream<R2 | R, E2 | E, A3 | A4>,
  <R2, E2, A2, A, A3, A4>(
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3 | A4>
>(
  4,
  <R, E, R2, E2, A2, A, A3, A4>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4
  ): Stream.Stream<R | R2, E | E2, A3 | A4> => mergeWithHaltStrategy(self, that, left, right, HaltStrategy.Both)
)

/** @internal */
export const mergeWithHaltStrategy = Debug.dual<
  <R, E, R2, E2, A2, A, A3, A4>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4,
    strategy: HaltStrategy.HaltStrategy
  ) => Stream.Stream<R2 | R, E2 | E, A3 | A4>,
  <R2, E2, A2, A, A3, A4>(
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4,
    strategy: HaltStrategy.HaltStrategy
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3 | A4>
>(
  5,
  <R, E, R2, E2, A2, A, A3, A4>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A4,
    strategy: HaltStrategy.HaltStrategy
  ): Stream.Stream<R | R2, E | E2, A3 | A4> => {
    const handler = (terminate: boolean) =>
      (exit: Exit.Exit<E | E2, unknown>): MergeDecision.MergeDecision<R | R2, E | E2, unknown, E | E2, unknown> =>
        terminate || !Exit.isSuccess(exit) ?
          MergeDecision.Done(Effect.done(exit)) :
          MergeDecision.Await(Effect.done)
    return new StreamImpl<R | R2, E | E2, A3 | A4>(
      pipe(
        pipe(self, map(left)).channel,
        channel.mergeWith(
          pipe(that, map(right)).channel,
          handler(strategy === haltStrategy.Either || strategy === haltStrategy.Left),
          handler(strategy === haltStrategy.Either || strategy === haltStrategy.Right)
        )
      )
    )
  }
)

/** @internal */
export const mkString = Debug.methodWithTrace((trace) =>
  <R, E>(self: Stream.Stream<R, E, string>): Effect.Effect<R, E, string> =>
    pipe(self, run(_sink.mkString())).traced(trace)
)

/** @internal */
export const never = (): Stream.Stream<never, never, never> => fromEffect(Effect.never())

/** @internal */
export const onError = Debug.dual<
  <R, A, E, R2, _>(
    self: Stream.Stream<R, E, A>,
    cleanup: (cause: Cause.Cause<E>) => Effect.Effect<R2, never, _>
  ) => Stream.Stream<R2 | R, E, A>,
  <E, R2, _>(
    cleanup: (cause: Cause.Cause<E>) => Effect.Effect<R2, never, _>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, A, E, R2, _>(
    self: Stream.Stream<R, E, A>,
    cleanup: (cause: Cause.Cause<E>) => Effect.Effect<R2, never, _>
  ): Stream.Stream<R | R2, E, A> =>
    pipe(self, catchAllCause((cause) => fromEffect(pipe(cleanup(cause), Effect.zipRight(Effect.failCause(cause))))))
)

/** @internal */
export const onDone = Debug.dual<
  <R, E, A, R2, _>(
    self: Stream.Stream<R, E, A>,
    cleanup: () => Effect.Effect<R2, never, _>
  ) => Stream.Stream<R2 | R, E, A>,
  <R2, _>(
    cleanup: () => Effect.Effect<R2, never, _>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, E, A, R2, _>(
    self: Stream.Stream<R, E, A>,
    cleanup: () => Effect.Effect<R2, never, _>
  ): Stream.Stream<R | R2, E, A> =>
    new StreamImpl<R | R2, E, A>(
      pipe(self.channel, core.ensuringWith((exit) => Exit.isSuccess(exit) ? cleanup() : Effect.unit()))
    )
)

/** @internal */
export const orDie = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, never, A> =>
  pipe(self, orDieWith(identity))

/** @internal */
export const orDieWith = Debug.dual<
  <R, A, E>(self: Stream.Stream<R, E, A>, f: (e: E) => unknown) => Stream.Stream<R, never, A>,
  <E>(f: (e: E) => unknown) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, never, A>
>(
  2,
  <R, A, E>(self: Stream.Stream<R, E, A>, f: (e: E) => unknown): Stream.Stream<R, never, A> =>
    new StreamImpl(pipe(self.channel, channel.orDieWith(f)))
)

/** @internal */
export const orElse = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2, A2 | A>,
  <R2, E2, A2>(
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E2, A | A2> =>
    new StreamImpl<R | R2, E2, A | A2>(pipe(self.channel, channel.orElse(() => that().channel)))
)

/** @internal */
export const orElseEither = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2, Either.Either<A, A2>>,
  <R2, E2, A2>(
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2, Either.Either<A, A2>>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: LazyArg<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E2, Either.Either<A, A2>> =>
    pipe(self, map(Either.left), orElse(() => pipe(that(), map(Either.right))))
)

/** @internal */
export const orElseFail = Debug.dual<
  <R, E, A, E2>(self: Stream.Stream<R, E, A>, error: LazyArg<E2>) => Stream.Stream<R, E2, A>,
  <E2>(error: LazyArg<E2>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A>
>(
  2,
  <R, E, A, E2>(self: Stream.Stream<R, E, A>, error: LazyArg<E2>): Stream.Stream<R, E2, A> =>
    pipe(self, orElse(() => failSync(error)))
)

/** @internal */
export const orElseIfEmpty = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, element: LazyArg<A2>) => Stream.Stream<R, E, A2 | A>,
  <A2>(element: LazyArg<A2>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2 | A>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, element: LazyArg<A2>): Stream.Stream<R, E, A | A2> =>
    pipe(self, orElseIfEmptyChunk(() => Chunk.of(element())))
)

/** @internal */
export const orElseIfEmptyChunk = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, chunk: LazyArg<Chunk.Chunk<A2>>) => Stream.Stream<R, E, A2 | A>,
  <A2>(chunk: LazyArg<Chunk.Chunk<A2>>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2 | A>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, chunk: LazyArg<Chunk.Chunk<A2>>): Stream.Stream<R, E, A | A2> =>
    pipe(self, orElseIfEmptyStream(() => new StreamImpl(core.write(chunk()))))
)

/** @internal */
export const orElseIfEmptyStream = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    stream: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    stream: LazyArg<Stream.Stream<R2, E2, A2>>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    stream: LazyArg<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A | A2> => {
    const writer: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A | A2>, unknown> = core.readWith(
      (input: Chunk.Chunk<A>) => {
        if (Chunk.isEmpty(input)) {
          return core.suspend(() => writer)
        }
        return pipe(
          core.write(input),
          channel.zipRight(channel.identityChannel<E, Chunk.Chunk<A>, unknown>())
        )
      },
      core.fail,
      () => core.suspend(() => stream().channel)
    )
    return new StreamImpl(pipe(self.channel, core.pipeTo(writer)))
  }
)

/** @internal */
export const orElseOptional = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, Option.Option<E>, A>,
    that: LazyArg<Stream.Stream<R2, Option.Option<E2>, A2>>
  ) => Stream.Stream<R2 | R, Option.Option<E2 | E>, A2 | A>,
  <R2, E2, A2>(
    that: LazyArg<Stream.Stream<R2, Option.Option<E2>, A2>>
  ) => <R, E, A>(self: Stream.Stream<R, Option.Option<E>, A>) => Stream.Stream<R2 | R, Option.Option<E2 | E>, A2 | A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, Option.Option<E>, A>,
    that: LazyArg<Stream.Stream<R2, Option.Option<E2>, A2>>
  ): Stream.Stream<R | R2, Option.Option<E | E2>, A | A2> =>
    pipe(self, catchAll(Option.match(that, (error) => fail(Option.some<E | E2>(error)))))
)

/** @internal */
export const orElseSucceed = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, value: LazyArg<A2>) => Stream.Stream<R, never, A2 | A>,
  <A2>(value: LazyArg<A2>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, never, A2 | A>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, A>, value: LazyArg<A2>): Stream.Stream<R, never, A | A2> =>
    pipe(self, orElse(() => sync(value)))
)

/** @internal */
export const paginate = <S, A>(s: S, f: (s: S) => readonly [A, Option.Option<S>]): Stream.Stream<never, never, A> =>
  paginateChunk(s, (s) => {
    const page = f(s)
    return [Chunk.of(page[0]), page[1]] as const
  })

/** @internal */
export const paginateChunk = <S, A>(
  s: S,
  f: (s: S) => readonly [Chunk.Chunk<A>, Option.Option<S>]
): Stream.Stream<never, never, A> => {
  const loop = (s: S): Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown> => {
    const page = f(s)
    return pipe(
      page[1],
      Option.match(
        () => pipe(core.write(page[0]), channel.zipRight(core.unit())),
        (s) => pipe(core.write(page[0]), core.flatMap(() => loop(s)))
      )
    )
  }
  return new StreamImpl(core.suspend(() => loop(s)))
}

/** @internal */
export const paginateChunkEffect = <S, R, E, A>(
  s: S,
  f: (s: S) => Effect.Effect<R, E, readonly [Chunk.Chunk<A>, Option.Option<S>]>
): Stream.Stream<R, E, A> => {
  const loop = (s: S): Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown> =>
    pipe(
      f(s),
      Effect.map(([chunk, option]) =>
        pipe(
          option,
          Option.match(
            () => pipe(core.write(chunk), channel.zipRight(core.unit())),
            (s) => pipe(core.write(chunk), core.flatMap(() => loop(s)))
          )
        )
      ),
      channel.unwrap
    )
  return new StreamImpl(core.suspend(() => loop(s)))
}

/** @internal */
export const paginateEffect = <S, R, E, A>(
  s: S,
  f: (s: S) => Effect.Effect<R, E, readonly [A, Option.Option<S>]>
): Stream.Stream<R, E, A> =>
  paginateChunkEffect(s, (s) => pipe(f(s), Effect.map(([a, s]) => [Chunk.of(a), s] as const)))

/** @internal */
export const peel = Debug.dualWithTrace<
  <R, E, R2, E2, A, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, A, Z>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, readonly [Z, Stream.Stream<never, E, A>]>,
  <R2, E2, A, Z>(
    sink: Sink.Sink<R2, E2, A, A, Z>
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, readonly [Z, Stream.Stream<never, E, A>]>
>(
  2,
  (trace) =>
    <R, E, R2, E2, A, Z>(
      self: Stream.Stream<R, E, A>,
      sink: Sink.Sink<R2, E2, A, A, Z>
    ): Effect.Effect<R | R2 | Scope.Scope, E2 | E, readonly [Z, Stream.Stream<never, E, A>]> => {
      type Signal = Emit | Halt | End
      const OP_EMIT = "Emit" as const
      type OP_EMIT = typeof OP_EMIT
      const OP_HALT = "Halt" as const
      type OP_HALT = typeof OP_HALT
      const OP_END = "End" as const
      type OP_END = typeof OP_END
      interface Emit {
        readonly _tag: OP_EMIT
        readonly elements: Chunk.Chunk<A>
      }
      interface Halt {
        readonly _tag: OP_HALT
        readonly cause: Cause.Cause<E>
      }
      interface End {
        readonly _tag: OP_END
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
                      _sink.fromEffect(Deferred.fail(deferred, error)),
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
                                Handoff.offer<Signal>({ _tag: OP_EMIT, elements })
                              )
                            ),
                            core.flatMap(() => loop)
                          ),
                        (cause) =>
                          pipe(
                            core.fromEffect(pipe(handoff, Handoff.offer<Signal>({ _tag: OP_HALT, cause }))),
                            channel.zipRight(core.failCause(cause))
                          ),
                        (_) =>
                          pipe(
                            core.fromEffect(pipe(handoff, Handoff.offer<Signal>({ _tag: OP_END }))),
                            channel.zipRight(core.unit())
                          )
                      )
                    return _sink.fromChannel(
                      pipe(
                        core.fromEffect(Deferred.succeed(deferred, z)),
                        channel.zipRight(core.fromEffect(
                          pipe(
                            handoff,
                            Handoff.offer<Signal>({ _tag: OP_EMIT, elements: leftovers })
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
                  switch (signal._tag) {
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
                tapErrorCause((cause) => Deferred.failCause(deferred, cause)),
                run(consumer),
                Effect.forkScoped,
                Effect.zipRight(Deferred.await(deferred)),
                Effect.map((z) => [z, new StreamImpl(producer)] as const)
              )
            })
          )
        ),
        Effect.flatten
      ).traced(trace)
    }
)

/** @internal */
export const partition = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    predicate: Predicate<A>
  ) => Effect.Effect<Scope.Scope | R, E, readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]>,
  <A>(
    predicate: Predicate<A>
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, E, readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Effect.Effect<
  R | Scope.Scope,
  E,
  readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]
> => partitionBuffer(self, predicate, 16))

/** @internal */
export const partitionBuffer = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    predicate: Predicate<A>,
    bufferSize: number
  ) => Effect.Effect<Scope.Scope | R, E, readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]>,
  <A>(
    predicate: Predicate<A>,
    bufferSize: number
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, E, readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]>
>(3, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>, bufferSize: number): Effect.Effect<
  R | Scope.Scope,
  E,
  readonly [Stream.Stream<never, E, A>, Stream.Stream<never, E, A>]
> =>
  pipe(
    self,
    partitionEitherBuffer((a) =>
      predicate(a) ?
        Effect.succeed(Either.left(a)) :
        Effect.succeed(Either.right(a)), bufferSize)
  ))

/** @internal */
export const partitionEither = Debug.dual<
  <R, E, A, R2, E2, A2, A3>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>
  ) => Effect.Effect<
    Scope.Scope | R2 | R,
    E2 | E,
    readonly [Stream.Stream<never, E2 | E, A2>, Stream.Stream<never, E2 | E, A3>]
  >,
  <A, R2, E2, A2, A3>(
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<
    Scope.Scope | R2 | R,
    E2 | E,
    readonly [Stream.Stream<never, E2 | E, A2>, Stream.Stream<never, E2 | E, A3>]
  >
>(
  2,
  <R, E, A, R2, E2, A2, A3>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>
  ): Effect.Effect<
    R | R2 | Scope.Scope,
    E | E2,
    readonly [Stream.Stream<never, E | E2, A2>, Stream.Stream<never, E | E2, A3>]
  > => partitionEitherBuffer(self, predicate, 16)
)

/** @internal */
export const partitionEitherBuffer = Debug.dual<
  <R, E, A, R2, E2, A2, A3>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>,
    bufferSize: number
  ) => Effect.Effect<
    Scope.Scope | R2 | R,
    E2 | E,
    readonly [Stream.Stream<never, E2 | E, A2>, Stream.Stream<never, E2 | E, A3>]
  >,
  <A, R2, E2, A2, A3>(
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>,
    bufferSize: number
  ) => <R, E>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<
    Scope.Scope | R2 | R,
    E2 | E,
    readonly [Stream.Stream<never, E2 | E, A2>, Stream.Stream<never, E2 | E, A3>]
  >
>(
  3,
  <R, E, A, R2, E2, A2, A3>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, Either.Either<A2, A3>>,
    bufferSize: number
  ): Effect.Effect<
    R | R2 | Scope.Scope,
    E | E2,
    readonly [Stream.Stream<never, E | E2, A2>, Stream.Stream<never, E | E2, A3>]
  > =>
    pipe(
      self,
      mapEffect(predicate),
      distributedWith(
        2,
        bufferSize,
        Either.match(
          () => Effect.succeed((n) => n === 0),
          () => Effect.succeed((n) => n === 1)
        )
      ),
      Effect.flatMap(([queue1, queue2]) =>
        Effect.succeed([
          collectLeft(flattenExitOption(fromQueueWithShutdown(queue1))),
          collectRight(flattenExitOption(fromQueueWithShutdown(queue2)))
        ])
      )
    )
)

/** @internal */
export const pipeThrough = Debug.dual<
  <R, E, R2, E2, A, L, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, L, Z>
  ) => Stream.Stream<R2 | R, E2 | E, L>,
  <R2, E2, A, L, Z>(
    sink: Sink.Sink<R2, E2, A, L, Z>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, L>
>(
  2,
  <R, E, R2, E2, A, L, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, L, Z>
  ): Stream.Stream<R | R2, E | E2, L> => new StreamImpl(pipe(self.channel, channel.pipeToOrFail(sink.channel)))
)

/** @internal */
export const pipeThroughChannel = Debug.dual<
  <R, R2, E, E2, A, A2>(
    self: Stream.Stream<R, E, A>,
    channel: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ) => Stream.Stream<R2 | R, E2, A2>,
  <R2, E, E2, A, A2>(
    channel: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ) => <R>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2, A2>
>(
  2,
  <R, R2, E, E2, A, A2>(
    self: Stream.Stream<R, E, A>,
    channel: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ): Stream.Stream<R | R2, E2, A2> => new StreamImpl(pipe(self.channel, core.pipeTo(channel)))
)

/** @internal */
export const pipeThroughChannelOrFail = Debug.dual<
  <R, R2, E, E2, A, A2>(
    self: Stream.Stream<R, E, A>,
    chan: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ) => Stream.Stream<R2 | R, E | E2, A2>,
  <R2, E, E2, A, A2>(
    chan: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ) => <R>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E | E2, A2>
>(
  2,
  <R, R2, E, E2, A, A2>(
    self: Stream.Stream<R, E, A>,
    chan: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E2, Chunk.Chunk<A2>, unknown>
  ): Stream.Stream<R | R2, E | E2, A2> => new StreamImpl(pipe(self.channel, channel.pipeToOrFail(chan)))
)

/** @internal */
export const prepend = <A>(values: Chunk.Chunk<A>): Stream.Stream<never, never, A> =>
  new StreamImpl(pipe(
    core.write(values),
    channel.zipRight(
      channel.identityChannel() as Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown>
    )
  ))

/** @internal */
export const provideContext = Debug.dual<
  <E, A, R>(self: Stream.Stream<R, E, A>, context: Context.Context<R>) => Stream.Stream<never, E, A>,
  <R>(context: Context.Context<R>) => <E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<never, E, A>
>(
  2,
  <E, A, R>(self: Stream.Stream<R, E, A>, context: Context.Context<R>): Stream.Stream<never, E, A> =>
    new StreamImpl(pipe(self.channel, core.provideContext(context)))
)

/** @internal */
export const provideLayer = Debug.dual<
  <E, A, RIn, E2, ROut>(
    self: Stream.Stream<ROut, E, A>,
    layer: Layer.Layer<RIn, E2, ROut>
  ) => Stream.Stream<RIn, E2 | E, A>,
  <RIn, E2, ROut>(
    layer: Layer.Layer<RIn, E2, ROut>
  ) => <E, A>(self: Stream.Stream<ROut, E, A>) => Stream.Stream<RIn, E2 | E, A>
>(
  2,
  <E, A, RIn, E2, ROut>(
    self: Stream.Stream<ROut, E, A>,
    layer: Layer.Layer<RIn, E2, ROut>
  ): Stream.Stream<RIn, E | E2, A> =>
    new StreamImpl(
      channel.unwrapScoped(pipe(
        Layer.build(layer),
        Effect.map((env) => pipe(self.channel, core.provideContext(env)))
      ))
    )
)

/** @internal */
export const provideService = Debug.dual<
  <R, E, A, T extends Context.Tag<any>>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    resource: Context.Tag.Service<T>
  ) => Stream.Stream<Exclude<R, Context.Tag.Service<T>>, E, A>,
  <T extends Context.Tag<any>>(
    tag: T,
    resource: Context.Tag.Service<T>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<Exclude<R, Context.Tag.Service<T>>, E, A>
>(
  3,
  <R, E, A, T extends Context.Tag<any>>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    resource: Context.Tag.Service<T>
  ) => provideServiceEffect(self, tag, Effect.succeed(resource))
)

/** @internal */
export const provideServiceEffect = Debug.dual<
  <R, E, A, T extends Context.Tag<any>, R2, E2>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    effect: Effect.Effect<R2, E2, Context.Tag.Service<T>>
  ) => Stream.Stream<R2 | Exclude<R, Context.Tag.Service<T>>, E2 | E, A>,
  <T extends Context.Tag<any>, R2, E2>(
    tag: T,
    effect: Effect.Effect<R2, E2, Context.Tag.Service<T>>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | Exclude<R, Context.Tag.Service<T>>, E2 | E, A>
>(
  3,
  <R, E, A, T extends Context.Tag<any>, R2, E2>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    effect: Effect.Effect<R2, E2, Context.Tag.Service<T>>
  ) => provideServiceStream(self, tag, fromEffect(effect))
)

/** @internal */
export const provideServiceStream = Debug.dual<
  <R, E, A, T extends Context.Tag<any>, R2, E2>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    stream: Stream.Stream<R2, E2, Context.Tag.Service<T>>
  ) => Stream.Stream<R2 | Exclude<R, Context.Tag.Service<T>>, E2 | E, A>,
  <T extends Context.Tag<any>, R2, E2>(
    tag: T,
    stream: Stream.Stream<R2, E2, Context.Tag.Service<T>>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | Exclude<R, Context.Tag.Service<T>>, E2 | E, A>
>(
  3,
  <R, E, A, T extends Context.Tag<any>, R2, E2>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    stream: Stream.Stream<R2, E2, Context.Tag.Service<T>>
  ): Stream.Stream<R2 | Exclude<R, Context.Tag.Service<T>>, E2 | E, A> =>
    contextWithStream((env: Context.Context<R2 | Exclude<R, Context.Tag.Service<T>>>) =>
      flatMap(
        stream,
        (service) => pipe(self, provideContext(Context.add(env, tag, service) as Context.Context<R | R2>))
      )
    )
)

/** @internal */
export const contramapContext = Debug.dual<
  <E, A, R0, R>(
    self: Stream.Stream<R, E, A>,
    f: (env: Context.Context<R0>) => Context.Context<R>
  ) => Stream.Stream<R0, E, A>,
  <R0, R>(
    f: (env: Context.Context<R0>) => Context.Context<R>
  ) => <E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R0, E, A>
>(
  2,
  <E, A, R0, R>(
    self: Stream.Stream<R, E, A>,
    f: (env: Context.Context<R0>) => Context.Context<R>
  ): Stream.Stream<R0, E, A> => contextWithStream((env) => pipe(self, provideContext(f(env))))
)

/** @internal */
export const provideSomeLayer = Debug.dual<
  <R, E, A, RIn, E2, ROut>(
    self: Stream.Stream<R, E, A>,
    layer: Layer.Layer<RIn, E2, ROut>
  ) => Stream.Stream<RIn | Exclude<R, ROut>, E2 | E, A>,
  <RIn, E2, ROut>(
    layer: Layer.Layer<RIn, E2, ROut>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<RIn | Exclude<R, ROut>, E2 | E, A>
>(
  2,
  <R, E, A, RIn, E2, ROut>(
    self: Stream.Stream<R, E, A>,
    layer: Layer.Layer<RIn, E2, ROut>
  ): Stream.Stream<RIn | Exclude<R, ROut>, E | E2, A> =>
    // @ts-expect-error
    pipe(
      self,
      provideLayer(pipe(Layer.context(), Layer.merge(layer)))
    )
)

/** @internal */
export const range = (min: number, max: number, chunkSize = DefaultChunkSize): Stream.Stream<never, never, number> =>
  suspend(() => {
    if (min >= max) {
      return empty as Stream.Stream<never, never, number>
    }
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
export const rechunk = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, n: number) => Stream.Stream<R, E, A>,
  (n: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, n: number): Stream.Stream<R, E, A> =>
  suspend(() => {
    const target = Math.max(n, 1)
    const process = rechunkProcess<E, A>(new StreamRechunker(target), target)
    return new StreamImpl(pipe(self.channel, core.pipeTo(process)))
  }))

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

  constructor(readonly n: number) {
  }

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
export const refineOrDie = Debug.dual<
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, pf: (error: E) => Option.Option<E2>) => Stream.Stream<R, E2, A>,
  <E, E2>(pf: (error: E) => Option.Option<E2>) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A>
>(
  2,
  <R, A, E, E2>(self: Stream.Stream<R, E, A>, pf: (error: E) => Option.Option<E2>): Stream.Stream<R, E2, A> =>
    pipe(self, refineOrDieWith(pf, identity))
)

/** @internal */
export const refineOrDieWith = Debug.dual<
  <R, A, E, E2>(
    self: Stream.Stream<R, E, A>,
    pf: (error: E) => Option.Option<E2>,
    f: (error: E) => unknown
  ) => Stream.Stream<R, E2, A>,
  <E, E2>(
    pf: (error: E) => Option.Option<E2>,
    f: (error: E) => unknown
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2, A>
>(
  3,
  <R, A, E, E2>(
    self: Stream.Stream<R, E, A>,
    pf: (error: E) => Option.Option<E2>,
    f: (error: E) => unknown
  ): Stream.Stream<R, E2, A> =>
    new StreamImpl(
      pipe(
        self.channel,
        channel.catchAll((error) =>
          pipe(
            pf(error),
            Option.match(
              () => core.failCause(Cause.die(f(error))),
              core.fail
            )
          )
        )
      )
    )
)

/** @internal */
export const repeat = Debug.dual<
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => Stream.Stream<R2 | R, E, A>,
  <R2, B>(
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ): Stream.Stream<R | R2, E, A> => pipe(self, repeatEither(schedule), collectRight)
)

/** @internal */
export const repeatEffect = <R, E, A>(effect: Effect.Effect<R, E, A>): Stream.Stream<R, E, A> =>
  repeatEffectOption(pipe(effect, Effect.mapError(Option.some)))

/** @internal */
export const repeatEffectChunk = <R, E, A>(effect: Effect.Effect<R, E, Chunk.Chunk<A>>): Stream.Stream<R, E, A> =>
  repeatEffectChunkOption(pipe(effect, Effect.mapError(Option.some)))

/** @internal */
export const repeatEffectChunkOption = <R, E, A>(
  effect: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>
): Stream.Stream<R, E, A> =>
  unfoldChunkEffect(effect, (effect) =>
    pipe(
      effect,
      Effect.map((chunk) => Option.some([chunk, effect] as const)),
      Effect.catchAll(Option.match(
        Effect.succeedNone,
        Effect.fail
      ))
    ))

/** @internal */
export const repeatEffectOption = <R, E, A>(effect: Effect.Effect<R, Option.Option<E>, A>): Stream.Stream<R, E, A> =>
  repeatEffectChunkOption(pipe(effect, Effect.map(Chunk.of)))

/** @internal */
export const repeatEither = Debug.dual<
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => Stream.Stream<R2 | R, E, Either.Either<B, A>>,
  <R2, B>(
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, Either.Either<B, A>>
>(
  2,
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ): Stream.Stream<R | R2, E, Either.Either<B, A>> =>
    pipe(self, repeatWith(schedule, (a): Either.Either<B, A> => Either.right(a), Either.left))
)

/** @internal */
export const repeatElements = Debug.dual<
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => Stream.Stream<R2 | R, E, A>,
  <R2, B>(
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ): Stream.Stream<R | R2, E, A> => pipe(self, repeatElementsEither(schedule), collectRight)
)

/** @internal */
export const repeatElementsEither = Debug.dual<
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => Stream.Stream<R2 | R, E, Either.Either<B, A>>,
  <R2, B>(
    schedule: Schedule.Schedule<R2, unknown, B>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, Either.Either<B, A>>
>(
  2,
  <R, E, A, R2, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>
  ): Stream.Stream<R | R2, E, Either.Either<B, A>> =>
    pipe(self, repeatElementsWith(schedule, (a): Either.Either<B, A> => Either.right(a), Either.left))
)

/** @internal */
export const repeatElementsWith = Debug.dual<
  <R, E, R2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => Stream.Stream<R2 | R, E, C>,
  <R2, B, A, C>(
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, C>
>(
  4,
  <R, E, R2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ): Stream.Stream<R | R2, E, C> => {
    const driver = pipe(
      Schedule.driver(schedule),
      Effect.map((driver) => {
        const feed = (
          input: Chunk.Chunk<A>
        ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<C>, void> =>
          pipe(
            Chunk.head(input),
            Option.match(
              () => loop,
              (a) =>
                pipe(
                  core.write(Chunk.of(f(a))),
                  channel.zipRight(step(pipe(input, Chunk.drop(1)), a))
                )
            )
          )
        const step = (
          input: Chunk.Chunk<A>,
          a: A
        ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<C>, void> => {
          const advance = pipe(
            driver.next(a),
            Effect.as(pipe(core.write(Chunk.of(f(a))), core.flatMap(() => step(input, a))))
          )
          const reset: Effect.Effect<
            R2,
            never,
            Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<C>, void>
          > = pipe(
            driver.last(),
            Effect.orDie,
            Effect.flatMap((b) =>
              pipe(
                driver.reset(),
                Effect.map(() =>
                  pipe(
                    core.write(Chunk.of(g(b))),
                    channel.zipRight(feed(input))
                  )
                )
              )
            )
          )
          return pipe(advance, Effect.orElse(() => reset), channel.unwrap)
        }
        const loop: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<C>, void> = core.readWith(
          feed,
          core.fail,
          core.unit
        )
        return loop
      }),
      channel.unwrap
    )
    return new StreamImpl(pipe(self.channel, core.pipeTo(driver)))
  }
)

/** @internal */
export const repeatForever = <A>(value: A): Stream.Stream<never, never, A> =>
  new StreamImpl(
    channel.repeated(core.write(Chunk.of(value)))
  )

/** @internal */
export const repeatWith = Debug.dual<
  <R, E, R2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => Stream.Stream<R2 | R, E, C>,
  <R2, B, A, C>(
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, C>
>(
  4,
  <R, E, R2, B, A, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, unknown, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ): Stream.Stream<R | R2, E, C> => {
    return pipe(
      Schedule.driver(schedule),
      Effect.map((driver) => {
        const scheduleOutput = pipe(driver.last(), Effect.orDie, Effect.map(g))
        const process = pipe(self, map(f)).channel
        const loop: Channel.Channel<R | R2, unknown, unknown, unknown, E, Chunk.Chunk<C>, void> = pipe(
          driver.next(void 0),
          Effect.match(
            core.unit,
            () =>
              pipe(
                process,
                channel.zipRight(
                  pipe(
                    scheduleOutput,
                    Effect.map((c) => pipe(core.write(Chunk.of(c)), core.flatMap(() => loop))),
                    channel.unwrap
                  )
                )
              )
          ),
          channel.unwrap
        )
        return new StreamImpl(pipe(process, channel.zipRight(loop)))
      }),
      unwrap
    )
  }
)

/**
 * Repeats the value using the provided schedule.
 *
 * @since 1.0.0
 * @category constructors
 */
export const repeatWithSchedule = <R, A, _>(
  value: A,
  schedule: Schedule.Schedule<R, A, _>
): Stream.Stream<R, never, A> => repeatEffectWithSchedule(Effect.succeed(value), schedule)

/** @internal */
export const repeatEffectWithSchedule = <R, E, A, R2, _>(
  effect: Effect.Effect<R, E, A>,
  schedule: Schedule.Schedule<R2, A, _>
): Stream.Stream<R | R2, E, A> =>
  pipe(
    fromEffect(pipe(effect, Effect.zip(Schedule.driver(schedule)))),
    flatMap(([a, driver]) =>
      pipe(
        succeed(a),
        concat(
          unfoldEffect(a, (s) =>
            pipe(
              driver.next(s),
              Effect.matchEffect(
                Effect.succeed,
                () => pipe(effect, Effect.map((nextA) => Option.some([nextA, nextA] as const)))
              )
            ))
        )
      )
    )
  )

/** @internal */
export const retry = Debug.dual<
  <R, A, R2, E, _>(self: Stream.Stream<R, E, A>, schedule: Schedule.Schedule<R2, E, _>) => Stream.Stream<R2 | R, E, A>,
  <R2, E, _>(
    schedule: Schedule.Schedule<R2, E, _>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, A, R2, E, _>(self: Stream.Stream<R, E, A>, schedule: Schedule.Schedule<R2, E, _>): Stream.Stream<R | R2, E, A> =>
    pipe(
      Schedule.driver(schedule),
      Effect.map((driver) => {
        const loop: Stream.Stream<R | R2, E, A> = pipe(
          self,
          catchAll((error) =>
            pipe(
              driver.next(error),
              Effect.matchEffect(
                () => Effect.fail(error),
                () => Effect.succeed(pipe(loop, tap(() => driver.reset())))
              ),
              unwrap
            )
          )
        )
        return loop
      }),
      unwrap
    )
)

/** @internal */
export const right = <R, E, A, A2>(
  self: Stream.Stream<R, E, Either.Either<A, A2>>
): Stream.Stream<R, Option.Option<E>, A2> =>
  pipe(self, mapError(Option.some), rightOrFail((): Option.Option<E> => Option.none()))

/** @internal */
export const rightOrFail = Debug.dual<
  <R, E, A, A2, E2>(
    self: Stream.Stream<R, E, Either.Either<A, A2>>,
    error: LazyArg<E2>
  ) => Stream.Stream<R, E2 | E, A2>,
  <E2>(
    error: LazyArg<E2>
  ) => <R, E, A, A2>(self: Stream.Stream<R, E, Either.Either<A, A2>>) => Stream.Stream<R, E2 | E, A2>
>(
  2,
  <R, E, A, A2, E2>(
    self: Stream.Stream<R, E, Either.Either<A, A2>>,
    error: LazyArg<E2>
  ): Stream.Stream<R, E | E2, A2> => pipe(self, mapEffect(Either.match(() => Effect.failSync(error), Effect.succeed)))
)

/** @internal */
export const run = Debug.dualWithTrace<
  <R, E, R2, E2, A, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, unknown, Z>
  ) => Effect.Effect<R2 | R, E2 | E, Z>,
  <R2, E2, A, Z>(
    sink: Sink.Sink<R2, E2, A, unknown, Z>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, Z>
>(
  2,
  (trace) =>
    <R, E, R2, E2, A, Z>(
      self: Stream.Stream<R, E, A>,
      sink: Sink.Sink<R2, E2, A, unknown, Z>
    ): Effect.Effect<R | R2, E | E2, Z> =>
      pipe(self.channel, channel.pipeToOrFail(sink.channel), channel.runDrain).traced(trace)
)

/** @internal */
export const runCollect = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, Chunk.Chunk<A>> =>
    pipe(self, run(_sink.collectAll())).traced(trace)
)

/** @internal */
export const runCount = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, number> => pipe(self, run(_sink.count())).traced(trace)
)

/** @internal */
export const runDrain = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, void> => pipe(self, run(_sink.drain())).traced(trace)
)

/** @internal */
export const runFold = Debug.dualWithTrace<
  <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S) => Effect.Effect<R, E, S>,
  <S, A>(s: S, f: (s: S, a: A) => S) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R, E, S>
>(
  3,
  (trace) =>
    <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S): Effect.Effect<R, E, S> =>
      pipe(self, runFoldWhileScoped(s, constTrue, f), Effect.scoped).traced(trace)
)

/** @internal */
export const runFoldEffect = Debug.dualWithTrace<
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => Effect.Effect<R2 | R, E2 | E, S>,
  <S, A, R2, E2>(
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, S>
>(
  3,
  (trace) =>
    <R, E, S, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      s: S,
      f: (s: S, a: A) => Effect.Effect<R2, E2, S>
    ): Effect.Effect<R | R2, E | E2, S> =>
      pipe(self, runFoldWhileScopedEffect(s, constTrue, f), Effect.scoped).traced(trace)
)

/** @internal */
export const runFoldScoped = Debug.dualWithTrace<
  <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S) => Effect.Effect<Scope.Scope | R, E, S>,
  <S, A>(s: S, f: (s: S, a: A) => S) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, E, S>
>(
  3,
  (trace) =>
    <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S): Effect.Effect<R | Scope.Scope, E, S> =>
      pipe(self, runFoldWhileScoped(s, constTrue, f)).traced(trace)
)

/** @internal */
export const runFoldScopedEffect = Debug.dualWithTrace<
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, S>,
  <S, A, R2, E2>(
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, S>
>(
  3,
  (trace) =>
    <R, E, S, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      s: S,
      f: (s: S, a: A) => Effect.Effect<R2, E2, S>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, S> =>
      pipe(self, runFoldWhileScopedEffect(s, constTrue, f)).traced(trace)
)

/** @internal */
export const runFoldWhile = Debug.dualWithTrace<
  <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, cont: Predicate<S>, f: (s: S, a: A) => S) => Effect.Effect<R, E, S>,
  <S, A>(
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => S
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R, E, S>
>(
  4,
  (trace) =>
    <R, E, S, A>(
      self: Stream.Stream<R, E, A>,
      s: S,
      cont: Predicate<S>,
      f: (s: S, a: A) => S
    ): Effect.Effect<R, E, S> => pipe(self, runFoldWhileScoped(s, cont, f), Effect.scoped).traced(trace)
)

/** @internal */
export const runFoldWhileEffect = Debug.dualWithTrace<
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => Effect.Effect<R2 | R, E2 | E, S>,
  <S, A, R2, E2>(
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, S>
>(
  4,
  (trace) =>
    <R, E, S, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      s: S,
      cont: Predicate<S>,
      f: (s: S, a: A) => Effect.Effect<R2, E2, S>
    ): Effect.Effect<R | R2, E | E2, S> => pipe(self, runFoldWhileScopedEffect(s, cont, f), Effect.scoped).traced(trace)
)

/** @internal */
export const runFoldWhileScoped = Debug.dualWithTrace<
  <R, E, S, A>(
    self: Stream.Stream<R, E, A>,
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => S
  ) => Effect.Effect<Scope.Scope | R, E, S>,
  <S, A>(
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => S
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, E, S>
>(
  4,
  (trace) =>
    <R, E, S, A>(
      self: Stream.Stream<R, E, A>,
      s: S,
      cont: Predicate<S>,
      f: (s: S, a: A) => S
    ): Effect.Effect<R | Scope.Scope, E, S> => pipe(self, runScoped(_sink.fold(s, cont, f))).traced(trace)
)

/** @internal */
export const runFoldWhileScopedEffect = Debug.dualWithTrace<
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, S>,
  <S, A, R2, E2>(
    s: S,
    cont: Predicate<S>,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, S>
>(
  4,
  (trace) =>
    <R, E, S, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      s: S,
      cont: Predicate<S>,
      f: (s: S, a: A) => Effect.Effect<R2, E2, S>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, S> =>
      pipe(self, runScoped(_sink.foldEffect(s, cont, f))).traced(trace)
)

/** @internal */
export const runForEach = Debug.dualWithTrace<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => Effect.Effect<R2 | R, E2 | E, void>,
  <A, R2, E2, _>(
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2, _>(
      self: Stream.Stream<R, E, A>,
      f: (a: A) => Effect.Effect<R2, E2, _>
    ): Effect.Effect<R | R2, E | E2, void> => pipe(self, run(_sink.forEach(f))).traced(trace)
)

/** @internal */
export const runForEachChunk = Debug.dualWithTrace<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
  ) => Effect.Effect<R2 | R, E2 | E, void>,
  <A, R2, E2, _>(
    f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2, _>(
      self: Stream.Stream<R, E, A>,
      f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
    ): Effect.Effect<R | R2, E | E2, void> => pipe(self, run(_sink.forEachChunk(f))).traced(trace)
)

/** @internal */
export const runForEachChunkScoped = Debug.dualWithTrace<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, void>,
  <A, R2, E2, _>(
    f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2, _>(
      self: Stream.Stream<R, E, A>,
      f: (a: Chunk.Chunk<A>) => Effect.Effect<R2, E2, _>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, void> => pipe(self, runScoped(_sink.forEachChunk(f))).traced(trace)
)

/** @internal */
export const runForEachScoped = Debug.dualWithTrace<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => Effect.Effect<R2 | R | Scope.Scope, E2 | E, void>,
  <A, R2, E2, _>(
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R | Scope.Scope, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2, _>(
      self: Stream.Stream<R, E, A>,
      f: (a: A) => Effect.Effect<R2, E2, _>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, void> => pipe(self, runScoped(_sink.forEach(f))).traced(trace)
)

/** @internal */
export const runForEachWhile = Debug.dualWithTrace<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Effect.Effect<R2 | R, E2 | E, void>,
  <A, R2, E2>(
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      f: (a: A) => Effect.Effect<R2, E2, boolean>
    ): Effect.Effect<R | R2, E | E2, void> => pipe(self, run(_sink.forEachWhile(f))).traced(trace)
)

/** @internal */
export const runForEachWhileScoped = Debug.dualWithTrace<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Effect.Effect<R2 | R | Scope.Scope, E2 | E, void>,
  <A, R2, E2>(
    f: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<R2 | R | Scope.Scope, E2 | E, void>
>(
  2,
  (trace) =>
    <R, E, A, R2, E2>(
      self: Stream.Stream<R, E, A>,
      f: (a: A) => Effect.Effect<R2, E2, boolean>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, void> => pipe(self, runScoped(_sink.forEachWhile(f))).traced(trace)
)

/** @internal */
export const runHead = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, Option.Option<A>> =>
    pipe(self, run(_sink.head<A>())).traced(trace)
)

/** @internal */
export const runIntoHub = Debug.dualWithTrace<
  <R, E, A>(self: Stream.Stream<R, E, A>, hub: Hub.Hub<Take.Take<E, A>>) => Effect.Effect<R, never, void>,
  <E, A>(hub: Hub.Hub<Take.Take<E, A>>) => <R>(self: Stream.Stream<R, E, A>) => Effect.Effect<R, never, void>
>(
  2,
  (trace) =>
    <R, E, A>(self: Stream.Stream<R, E, A>, hub: Hub.Hub<Take.Take<E, A>>): Effect.Effect<R, never, void> =>
      pipe(self, runIntoQueue(hub)).traced(trace)
)

/** @internal */
export const runIntoHubScoped = Debug.dualWithTrace<
  <R, E, A>(self: Stream.Stream<R, E, A>, hub: Hub.Hub<Take.Take<E, A>>) => Effect.Effect<Scope.Scope | R, never, void>,
  <E, A>(
    hub: Hub.Hub<Take.Take<E, A>>
  ) => <R>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, void>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      hub: Hub.Hub<Take.Take<E, A>>
    ): Effect.Effect<R | Scope.Scope, never, void> => pipe(self, runIntoQueueScoped(hub)).traced(trace)
)

/** @internal */
export const runIntoQueue = Debug.dualWithTrace<
  <R, E, A>(self: Stream.Stream<R, E, A>, queue: Queue.Enqueue<Take.Take<E, A>>) => Effect.Effect<R, never, void>,
  <E, A>(queue: Queue.Enqueue<Take.Take<E, A>>) => <R>(self: Stream.Stream<R, E, A>) => Effect.Effect<R, never, void>
>(
  2,
  (trace) =>
    <R, E, A>(self: Stream.Stream<R, E, A>, queue: Queue.Enqueue<Take.Take<E, A>>): Effect.Effect<R, never, void> =>
      pipe(self, runIntoQueueScoped(queue), Effect.scoped).traced(trace)
)

/** @internal */
export const runIntoQueueElementsScoped = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    queue: Queue.Enqueue<Exit.Exit<Option.Option<E>, A>>
  ) => Effect.Effect<Scope.Scope | R, never, void>,
  <E, A>(
    queue: Queue.Enqueue<Exit.Exit<Option.Option<E>, A>>
  ) => <R>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, void>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      queue: Queue.Enqueue<Exit.Exit<Option.Option<E>, A>>
    ): Effect.Effect<R | Scope.Scope, never, void> => {
      const writer: Channel.Channel<R, E, Chunk.Chunk<A>, unknown, never, Exit.Exit<Option.Option<E>, A>, unknown> =
        core
          .readWithCause(
            (input: Chunk.Chunk<A>) =>
              pipe(
                input,
                Chunk.reduce(
                  core.unit() as Channel.Channel<
                    R,
                    E,
                    Chunk.Chunk<A>,
                    unknown,
                    never,
                    Exit.Exit<Option.Option<E>, A>,
                    unknown
                  >,
                  (acc, a) =>
                    pipe(
                      acc,
                      channel.zipRight(core.write(Exit.succeed(a)))
                    )
                ),
                core.flatMap(() => writer)
              ),
            (cause) => pipe(core.write(Exit.failCause(pipe(cause, Cause.map(Option.some))))),
            () => core.write(Exit.fail(Option.none()))
          )
      return pipe(
        self.channel,
        core.pipeTo(writer),
        channel.mapOutEffect((exit) => pipe(Queue.offer(queue, exit))),
        channel.drain,
        channelExecutor.runScoped,
        Effect.asUnit
      ).traced(trace)
    }
)

/** @internal */
export const runIntoQueueScoped = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    queue: Queue.Enqueue<Take.Take<E, A>>
  ) => Effect.Effect<Scope.Scope | R, never, void>,
  <E, A>(
    queue: Queue.Enqueue<Take.Take<E, A>>
  ) => <R>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, void>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      queue: Queue.Enqueue<Take.Take<E, A>>
    ): Effect.Effect<R | Scope.Scope, never, void> => {
      const writer: Channel.Channel<R, E, Chunk.Chunk<A>, unknown, never, Take.Take<E, A>, unknown> = core
        .readWithCause(
          (input: Chunk.Chunk<A>) => pipe(core.write(_take.chunk(input)), core.flatMap(() => writer)),
          (cause) => core.write(_take.failCause(cause)),
          () => core.write(_take.end)
        )
      return pipe(
        self.channel,
        core.pipeTo(writer),
        channel.mapOutEffect((take) => pipe(Queue.offer(queue, take))),
        channel.drain,
        channelExecutor.runScoped,
        Effect.asUnit
      ).traced(trace)
    }
)

/** @internal */
export const runLast = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R, E, Option.Option<A>> =>
    pipe(self, run(_sink.last())).traced(trace)
)

/** @internal */
export const runScoped = Debug.dualWithTrace<
  <R, E, R2, E2, A, A2>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, unknown, A2>
  ) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, A2>,
  <R2, E2, A, A2>(
    sink: Sink.Sink<R2, E2, A, unknown, A2>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R2 | R, E2 | E, A2>
>(
  2,
  (trace) =>
    <R, E, R2, E2, A, A2>(
      self: Stream.Stream<R, E, A>,
      sink: Sink.Sink<R2, E2, A, unknown, A2>
    ): Effect.Effect<R | R2 | Scope.Scope, E | E2, A2> =>
      pipe(
        self.channel,
        channel.pipeToOrFail(sink.channel),
        channel.drain,
        channelExecutor.runScoped
      ).traced(trace)
)

/** @internal */
export const runSum = Debug.methodWithTrace((trace) =>
  <R, E>(self: Stream.Stream<R, E, number>): Effect.Effect<R, E, number> => pipe(self, run(_sink.sum())).traced(trace)
)

/** @internal */
export const scan = Debug.dual<
  <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S) => Stream.Stream<R, E, S>,
  <S, A>(s: S, f: (s: S, a: A) => S) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, S>
>(
  3,
  <R, E, S, A>(self: Stream.Stream<R, E, A>, s: S, f: (s: S, a: A) => S): Stream.Stream<R, E, S> =>
    pipe(self, scanEffect(s, (s, a) => Effect.succeed(f(s, a))))
)

/** @internal */
export const scanReduce = Debug.dual<
  <R, E, A2, A>(self: Stream.Stream<R, E, A>, f: (a2: A2 | A, a: A) => A2) => Stream.Stream<R, E, A2 | A>,
  <A2, A>(f: (a2: A2 | A, a: A) => A2) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A2 | A>
>(
  2,
  <R, E, A2, A>(self: Stream.Stream<R, E, A>, f: (a2: A | A2, a: A) => A2): Stream.Stream<R, E, A | A2> =>
    pipe(self, scanReduceEffect((a2, a) => Effect.succeed(f(a2, a))))
)

/** @internal */
export const scanReduceEffect = Debug.dual<
  <R, E, A2, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a2: A2 | A, a: A) => Effect.Effect<R2, E2, A2 | A>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <A2, A, R2, E2>(
    f: (a2: A2 | A, a: A) => Effect.Effect<R2, E2, A2 | A>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  2,
  <R, E, A2, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    f: (a2: A | A2, a: A) => Effect.Effect<R2, E2, A | A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> =>
    pipe(
      self,
      mapAccumEffect<Option.Option<A | A2>, A, R2, E2, A | A2>(Option.none() as Option.Option<A | A2>, (option, a) => {
        switch (option._tag) {
          case "None": {
            return Effect.succeed([Option.some<A | A2>(a), a] as const)
          }
          case "Some": {
            return pipe(
              f(option.value, a),
              Effect.map((b) => [Option.some<A | A2>(b), b] as const)
            )
          }
        }
      })
    )
)

/** @internal */
export const schedule = Debug.dual<
  <R, E, R2, A>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, unknown>
  ) => Stream.Stream<R2 | R, E, A>,
  <R2, A>(
    schedule: Schedule.Schedule<R2, A, unknown>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, A>
>(
  2,
  <R, E, R2, A>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, unknown>
  ): Stream.Stream<R | R2, E, A> => pipe(self, scheduleEither(schedule), collectRight)
)

/** @internal */
export const scheduleEither = Debug.dual<
  <R, E, R2, A, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, B>
  ) => Stream.Stream<R2 | R, E, Either.Either<B, A>>,
  <R2, A, B>(
    schedule: Schedule.Schedule<R2, A, B>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, Either.Either<B, A>>
>(
  2,
  <R, E, R2, A, B>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, B>
  ): Stream.Stream<R | R2, E, Either.Either<B, A>> =>
    pipe(self, scheduleWith(schedule, (a): Either.Either<B, A> => Either.right(a), Either.left))
)

/** @internal */
export const scheduleWith = Debug.dual<
  <R, E, R2, A, B, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => Stream.Stream<R2 | R, E, C>,
  <R2, A, B, C>(
    schedule: Schedule.Schedule<R2, A, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E, C>
>(
  4,
  <R, E, R2, A, B, C>(
    self: Stream.Stream<R, E, A>,
    schedule: Schedule.Schedule<R2, A, B>,
    f: (a: A) => C,
    g: (b: B) => C
  ): Stream.Stream<R | R2, E, C> => {
    const loop = (
      driver: Schedule.ScheduleDriver<R2, A, B>,
      iterator: Iterator<A>
    ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<C>, unknown> => {
      const next = iterator.next()
      if (next.done) {
        return core.readWithCause(
          (chunk: Chunk.Chunk<A>) => loop(driver, chunk[Symbol.iterator]()),
          core.failCause,
          core.succeedNow
        )
      }
      return pipe(
        driver.next(next.value),
        Effect.matchEffect(
          () =>
            pipe(
              driver.last(),
              Effect.orDie,
              Effect.map((b) =>
                pipe(
                  core.write(Chunk.make(f(next.value), g(b))),
                  core.flatMap(() => loop(driver, iterator))
                )
              ),
              Effect.zipLeft(driver.reset())
            ),
          () =>
            Effect.succeed(pipe(
              core.write(Chunk.of(f(next.value))),
              core.flatMap(() => loop(driver, iterator))
            ))
        ),
        channel.unwrap
      )
    }
    return new StreamImpl(
      pipe(
        core.fromEffect(Schedule.driver(schedule)),
        core.flatMap((driver) =>
          pipe(
            self.channel,
            core.pipeTo(loop(driver, Chunk.empty<A>()[Symbol.iterator]()))
          )
        )
      )
    )
  }
)

/** @internal */
export const scanEffect = Debug.dual<
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => Stream.Stream<R2 | R, E2 | E, S>,
  <S, A, R2, E2>(
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, S>
>(
  3,
  <R, E, S, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    s: S,
    f: (s: S, a: A) => Effect.Effect<R2, E2, S>
  ): Stream.Stream<R | R2, E | E2, S> =>
    new StreamImpl(
      pipe(
        core.write(Chunk.of(s)),
        core.flatMap(() =>
          pipe(
            self,
            mapAccumEffect(s, (s, a) => pipe(f(s, a), Effect.map((s) => [s, s])))
          ).channel
        )
      )
    )
)

/** @internal */
export const scoped = <R, E, A>(
  effect: Effect.Effect<R | Scope.Scope, E, A>
): Stream.Stream<Exclude<R | Scope.Scope, Scope.Scope>, E, A> =>
  new StreamImpl(channel.scoped(pipe(effect, Effect.map(Chunk.of))))

/** @internal */
export const service = <T>(tag: Context.Tag<T>): Stream.Stream<T, never, T> => serviceWith(tag, identity)

/** @internal */
export const serviceWith = <T extends Context.Tag<any>, A>(
  tag: T,
  f: (service: Context.Tag.Service<T>) => A
): Stream.Stream<Context.Tag.Service<T>, never, A> => fromEffect(Effect.serviceWith(tag, f))

/** @internal */
export const serviceWithEffect = <T extends Context.Tag<any>, R, E, A>(
  tag: T,
  f: (service: Context.Tag.Service<T>) => Effect.Effect<R, E, A>
): Stream.Stream<R | Context.Tag.Service<T>, E, A> => fromEffect(Effect.serviceWithEffect(tag, f))

/** @internal */
export const serviceWithStream = <T extends Context.Tag<any>, R, E, A>(
  tag: T,
  f: (service: Context.Tag.Service<T>) => Stream.Stream<R, E, A>
): Stream.Stream<R | Context.Tag.Service<T>, E, A> => flatMap(service(tag), f)

/** @internal */
export const some = <R, E, A>(self: Stream.Stream<R, E, Option.Option<A>>): Stream.Stream<R, Option.Option<E>, A> =>
  pipe(self, mapError(Option.some), someOrFail(() => Option.none()))

/** @internal */
export const someOrElse = Debug.dual<
  <R, E, A, A2>(self: Stream.Stream<R, E, Option.Option<A>>, fallback: LazyArg<A2>) => Stream.Stream<R, E, A2 | A>,
  <A2>(fallback: LazyArg<A2>) => <R, E, A>(self: Stream.Stream<R, E, Option.Option<A>>) => Stream.Stream<R, E, A2 | A>
>(
  2,
  <R, E, A, A2>(self: Stream.Stream<R, E, Option.Option<A>>, fallback: LazyArg<A2>): Stream.Stream<R, E, A | A2> =>
    pipe(self, map(Option.getOrElse(fallback)))
)

/** @internal */
export const someOrFail = Debug.dual<
  <R, E, A, E2>(self: Stream.Stream<R, E, Option.Option<A>>, error: LazyArg<E2>) => Stream.Stream<R, E2 | E, A>,
  <E2>(error: LazyArg<E2>) => <R, E, A>(self: Stream.Stream<R, E, Option.Option<A>>) => Stream.Stream<R, E2 | E, A>
>(
  2,
  <R, E, A, E2>(self: Stream.Stream<R, E, Option.Option<A>>, error: LazyArg<E2>): Stream.Stream<R, E | E2, A> =>
    pipe(self, mapEffect(Option.match(() => Effect.failSync(error), Effect.succeed)))
)

/** @internal */
export const sliding = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  (
    chunkSize: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number): Stream.Stream<R, E, Chunk.Chunk<A>> =>
    slidingSize(self, chunkSize, 1)
)

/** @internal */
export const slidingSize = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number, stepSize: number) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  (
    chunkSize: number,
    stepSize: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(
  3,
  <R, E, A>(self: Stream.Stream<R, E, A>, chunkSize: number, stepSize: number): Stream.Stream<R, E, Chunk.Chunk<A>> => {
    if (chunkSize <= 0 || stepSize <= 0) {
      return die(
        Cause.IllegalArgumentException("Invalid bounds - `chunkSize` and `stepSize` must be greater than zero")
      )
    }
    return new StreamImpl(core.suspend(() => {
      const queue = new RingBuffer<A>(chunkSize)
      const emitOnStreamEnd = (
        queueSize: number,
        channelEnd: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown>
      ) => {
        if (queueSize < chunkSize) {
          const items = queue.toChunk()
          const result = Chunk.isEmpty(items) ? Chunk.empty<Chunk.Chunk<A>>() : Chunk.of(items)
          return pipe(core.write(result), core.flatMap(() => channelEnd))
        }
        const lastEmitIndex = queueSize - (queueSize - chunkSize) % stepSize
        if (lastEmitIndex === queueSize) {
          return channelEnd
        }
        const leftovers = queueSize - (lastEmitIndex - chunkSize + stepSize)
        const lastItems = pipe(queue.toChunk(), Chunk.takeRight(leftovers))
        const result = Chunk.isEmpty(lastItems) ? Chunk.empty<Chunk.Chunk<A>>() : Chunk.of(lastItems)
        return pipe(core.write(result), core.flatMap(() => channelEnd))
      }
      const reader = (
        queueSize: number
      ): Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown> =>
        core.readWithCause(
          (input: Chunk.Chunk<A>) =>
            pipe(
              core.write(
                pipe(
                  Chunk.zipWithIndex(input),
                  Chunk.filterMap(([element, index]) => {
                    queue.put(element)
                    const currentIndex = queueSize + index + 1
                    if (currentIndex < chunkSize || (currentIndex - chunkSize) % stepSize > 0) {
                      return Option.none()
                    }
                    return Option.some(queue.toChunk())
                  })
                )
              ),
              core.flatMap(() => reader(queueSize + input.length))
            ),
          (cause) => emitOnStreamEnd(queueSize, core.failCause(cause)),
          () => emitOnStreamEnd(queueSize, core.unit())
        )
      return pipe(self.channel, core.pipeTo(reader(0)))
    }))
  }
)

/** @internal */
export const split = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  <A>(predicate: Predicate<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, Chunk.Chunk<A>> => {
  const split = (
    leftovers: Chunk.Chunk<A>,
    input: Chunk.Chunk<A>
  ): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown> => {
    const [chunk, remaining] = pipe(leftovers, Chunk.concat(input), Chunk.splitWhere(predicate))
    if (Chunk.isEmpty(chunk) || Chunk.isEmpty(remaining)) {
      return loop(pipe(chunk, Chunk.concat(pipe(remaining, Chunk.drop(1)))))
    }
    return pipe(
      core.write(Chunk.of(chunk)),
      core.flatMap(() => split(Chunk.empty(), pipe(remaining, Chunk.drop(1))))
    )
  }
  const loop = (
    leftovers: Chunk.Chunk<A>
  ): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown> =>
    core.readWith(
      (input: Chunk.Chunk<A>) => split(leftovers, input),
      core.fail,
      () => {
        if (Chunk.isEmpty(leftovers)) {
          return core.unit()
        }
        if (Option.isNone(pipe(leftovers, Chunk.findFirst(predicate)))) {
          return pipe(core.write(Chunk.of(leftovers)), channel.zipRight(core.unit()))
        }
        return pipe(split(Chunk.empty(), leftovers), channel.zipRight(core.unit()))
      }
    )
  return new StreamImpl(pipe(self.channel, core.pipeTo(loop(Chunk.empty()))))
})

/** @internal */
export const splitOnChunk = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, delimiter: Chunk.Chunk<A>) => Stream.Stream<R, E, Chunk.Chunk<A>>,
  <A>(delimiter: Chunk.Chunk<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, Chunk.Chunk<A>>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, delimiter: Chunk.Chunk<A>): Stream.Stream<R, E, Chunk.Chunk<A>> => {
  const next = (
    leftover: Option.Option<Chunk.Chunk<A>>,
    delimiterIndex: number
  ): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<Chunk.Chunk<A>>, unknown> =>
    core.readWithCause(
      (inputChunk: Chunk.Chunk<A>) => {
        let buffer: Array<Chunk.Chunk<A>> | undefined
        const [carry, delimiterCursor] = pipe(
          inputChunk,
          Chunk.reduce(
            [pipe(leftover, Option.getOrElse(() => Chunk.empty<A>())), delimiterIndex] as const,
            ([carry, delimiterCursor], a) => {
              const concatenated = pipe(carry, Chunk.append(a))
              if (
                delimiterCursor < delimiter.length &&
                Equal.equals(a, pipe(delimiter, Chunk.unsafeGet(delimiterCursor)))
              ) {
                if (delimiterCursor + 1 === delimiter.length) {
                  if (buffer === undefined) {
                    buffer = []
                  }
                  buffer.push(pipe(concatenated, Chunk.take(concatenated.length - delimiter.length)))
                  return [Chunk.empty<A>(), 0] as const
                }
                return [concatenated, delimiterCursor + 1] as const
              }
              return [concatenated, Equal.equals(a, pipe(delimiter, Chunk.unsafeGet(0))) ? 1 : 0] as const
            }
          )
        )
        const output = buffer === undefined ? Chunk.empty<Chunk.Chunk<A>>() : Chunk.unsafeFromArray(buffer)
        return pipe(
          core.write(output),
          core.flatMap(() => next(Chunk.isNonEmpty(carry) ? Option.some(carry) : Option.none(), delimiterCursor))
        )
      },
      (cause) =>
        pipe(
          leftover,
          Option.match(
            () => core.failCause(cause),
            (chunk) => pipe(core.write(Chunk.of(chunk)), channel.zipRight(core.failCause(cause)))
          )
        ),
      (done) =>
        pipe(
          leftover,
          Option.match(
            () => core.succeed(done),
            (chunk) => pipe(core.write(Chunk.of(chunk)), channel.zipRight(core.succeed(done)))
          )
        )
    )
  return new StreamImpl(pipe(self.channel, core.pipeTo(next(Option.none(), 0))))
})

/** @internal */
export const succeed = <A>(value: A): Stream.Stream<never, never, A> => fromChunk(Chunk.of(value))

/** @internal */
export const sync = <A>(evaluate: LazyArg<A>): Stream.Stream<never, never, A> =>
  suspend(() => fromChunk(Chunk.of(evaluate())))

/** @internal */
export const suspend = <R, E, A>(stream: LazyArg<Stream.Stream<R, E, A>>): Stream.Stream<R, E, A> =>
  new StreamImpl(core.suspend(() => stream().channel))

/** @internal */
export const take = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, n: number) => Stream.Stream<R, E, A>,
  (n: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, n: number): Stream.Stream<R, E, A> => {
  if (!Number.isInteger(n)) {
    return die(Cause.IllegalArgumentException(`${n} must be an integer`))
  }
  const loop = (n: number): Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<A>, unknown> =>
    core.readWith(
      (input: Chunk.Chunk<A>) => {
        const taken = pipe(input, Chunk.take(Math.min(n, Number.POSITIVE_INFINITY)))
        const leftover = Math.max(0, n - taken.length)
        const more = leftover > 0
        if (more) {
          return pipe(core.write(taken), core.flatMap(() => loop(leftover)))
        }
        return core.write(taken)
      },
      core.fail,
      core.succeed
    )
  return new StreamImpl(
    pipe(
      self.channel,
      channel.pipeToOrFail(0 < n ? loop(n) : core.unit())
    )
  )
})

/** @internal */
export const takeRight = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, n: number) => Stream.Stream<R, E, A>,
  (n: number) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, n: number): Stream.Stream<R, E, A> => {
  if (n <= 0) {
    return empty
  }
  return new StreamImpl(
    pipe(
      Effect.succeed(new RingBuffer<A>(n)),
      Effect.map((queue) => {
        const reader: Channel.Channel<never, E, Chunk.Chunk<A>, unknown, E, Chunk.Chunk<A>, void> = core.readWith(
          (input: Chunk.Chunk<A>) => {
            for (const element of input) {
              queue.put(element)
            }
            return reader
          },
          core.fail,
          () => pipe(core.write(queue.toChunk()), channel.zipRight(core.unit()))
        )
        return pipe(self.channel, core.pipeTo(reader))
      }),
      channel.unwrap
    )
  )
})

/** @internal */
export const takeUntil = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => Stream.Stream<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A> => {
  const loop: Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<A>, unknown> = core.readWith(
    (input: Chunk.Chunk<A>) => {
      const taken = pipe(input, Chunk.takeWhile((a) => !predicate(a)))
      const last = pipe(input, Chunk.drop(taken.length), Chunk.take(1))
      if (Chunk.isEmpty(last)) {
        return pipe(core.write(taken), core.flatMap(() => loop))
      }
      return core.write(pipe(taken, Chunk.concat(last)))
    },
    core.fail,
    core.succeed
  )
  return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
})

/** @internal */
export const takeUntilEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    predicate: (a: A) => Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop = (
      iterator: Iterator<A>
    ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> => {
      const next = iterator.next()
      if (next.done) {
        return core.readWithCause(
          (elem) => loop(elem[Symbol.iterator]()),
          core.failCause,
          core.succeed
        )
      }
      return pipe(
        predicate(next.value),
        Effect.map((bool) =>
          bool ?
            core.write(Chunk.of(next.value)) :
            pipe(
              core.write(Chunk.of(next.value)),
              core.flatMap(() => loop(iterator))
            )
        ),
        channel.unwrap
      )
    }
    return new StreamImpl(pipe(self.channel, core.pipeTo(loop(Chunk.empty<A>()[Symbol.iterator]()))))
  }
)

/** @internal */
export const takeWhile = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>) => Stream.Stream<R, E, A>,
  <A>(predicate: Predicate<A>) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, predicate: Predicate<A>): Stream.Stream<R, E, A> => {
  const loop: Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<A>, unknown> = core.readWith(
    (input: Chunk.Chunk<A>) => {
      const taken = pipe(input, Chunk.takeWhile(predicate))
      const more = taken.length === input.length
      if (more) {
        return pipe(core.write(taken), core.flatMap(() => loop))
      }
      return core.write(taken)
    },
    core.fail,
    core.succeed
  )
  return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(loop)))
})

/** @internal */
export const tap = Debug.dual<
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2, _>(
    f: (a: A) => Effect.Effect<R2, E2, _>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (a: A) => Effect.Effect<R2, E2, _>
  ): Stream.Stream<R | R2, E | E2, A> => pipe(self, mapEffect((a) => pipe(f(a), Effect.as(a))))
)

/** @internal */
export const tapError = Debug.dual<
  <R, A, E, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (error: E) => Effect.Effect<R2, E2, _>
  ) => Stream.Stream<R2 | R, E | E2, A>,
  <E, R2, E2, _>(
    f: (error: E) => Effect.Effect<R2, E2, _>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E | E2, A>
>(
  2,
  <R, A, E, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (error: E) => Effect.Effect<R2, E2, _>
  ): Stream.Stream<R | R2, E | E2, A> =>
    pipe(self, catchAll((error) => fromEffect(pipe(f(error), Effect.zipRight(Effect.fail(error))))))
)

/** @internal */
export const tapErrorCause = Debug.dual<
  <R, A, E, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, _>
  ) => Stream.Stream<R2 | R, E | E2, A>,
  <E, R2, E2, _>(
    f: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, _>
  ) => <R, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E | E2, A>
>(
  2,
  <R, A, E, R2, E2, _>(
    self: Stream.Stream<R, E, A>,
    f: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, _>
  ): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      self,
      catchAllCause((cause) => fromEffect(pipe(f(cause), Effect.zipRight(Effect.failCause(cause)))))
    )
)

/** @internal */
export const tapSink = Debug.dual<
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, unknown, unknown>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A>(
    sink: Sink.Sink<R2, E2, A, unknown, unknown>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, R2, E2, A>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, unknown, unknown>
  ): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      fromEffect(Queue.bounded<Take.Take<E | E2, A>>(1)),
      flatMap((queue) => {
        const right = flattenTake(fromQueue(queue, 1))
        const loop: Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, unknown> = core
          .readWithCause(
            (chunk: Chunk.Chunk<A>) =>
              pipe(
                core.fromEffect(pipe(Queue.offer(queue, _take.chunk(chunk)))),
                channel.zipRight(core.write(chunk)),
                core.flatMap(() => loop)
              ),
            (cause) => core.fromEffect(pipe(Queue.offer(queue, _take.failCause(cause)))),
            () => core.fromEffect(pipe(Queue.offer(queue, _take.end)))
          )
        return pipe(
          new StreamImpl(pipe(self.channel, core.pipeTo(loop))),
          mergeHaltStrategy(execute(pipe(right, run(sink))), haltStrategy.Both)
        )
      })
    )
)

/** @internal */
export const throttleEnforce = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ) => Stream.Stream<R, E, A>,
  <A>(
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  4,
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ): Stream.Stream<R, E, A> => throttleEnforceBurst(self, costFn, units, duration, 0)
)

/** @internal */
export const throttleEnforceBurst = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => Stream.Stream<R, E, A>,
  <A>(
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  5,
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ): Stream.Stream<R, E, A> =>
    throttleEnforceEffectBurst(self, (chunk) => Effect.succeed(costFn(chunk)), units, duration, burst)
)

/** @internal */
export const throttleEnforceEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  4,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ): Stream.Stream<R | R2, E | E2, A> => throttleEnforceEffectBurst(self, costFn, units, duration, 0)
)

/** @internal */
export const throttleEnforceEffectBurst = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  5,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop = (
      tokens: number,
      timestampMillis: number
    ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void> =>
      core.readWithCause(
        (input: Chunk.Chunk<A>) =>
          pipe(
            costFn(input),
            Effect.zip(Clock.currentTimeMillis()),
            Effect.map(([weight, currentTimeMillis]) => {
              const elapsed = currentTimeMillis - timestampMillis
              const cycles = elapsed / duration.millis
              const sum = tokens + (cycles * units)
              const max = units + burst < 0 ? Number.POSITIVE_INFINITY : units + burst
              const available = sum < 0 ? max : Math.min(sum, max)
              if (weight <= available) {
                return pipe(
                  core.write(input),
                  core.flatMap(() => loop(available - weight, currentTimeMillis))
                )
              }
              return loop(available, currentTimeMillis)
            }),
            channel.unwrap
          ),
        core.failCause,
        core.unit
      )
    const throttled = pipe(
      Clock.currentTimeMillis(),
      Effect.map((currentTimeMillis) => loop(units, currentTimeMillis)),
      channel.unwrap
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(throttled)))
  }
)

/** @internal */
export const throttleShape = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ) => Stream.Stream<R, E, A>,
  <A>(
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  4,
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration
  ): Stream.Stream<R, E, A> => throttleShapeBurst(self, costFn, units, duration, 0)
)

/** @internal */
export const throttleShapeBurst = Debug.dual<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => Stream.Stream<R, E, A>,
  <A>(
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  5,
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => number,
    units: number,
    duration: Duration.Duration,
    burst: number
  ): Stream.Stream<R, E, A> =>
    throttleShapeEffectBurst(self, (chunk) => Effect.succeed(costFn(chunk)), units, duration, burst)
)

/** @internal */
export const throttleShapeEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  4,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration
  ): Stream.Stream<R | R2, E | E2, A> => throttleShapeEffectBurst(self, costFn, units, duration, 0)
)

/** @internal */
export const throttleShapeEffectBurst = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <A, R2, E2>(
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  5,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    costFn: (chunk: Chunk.Chunk<A>) => Effect.Effect<R2, E2, number>,
    units: number,
    duration: Duration.Duration,
    burst: number
  ): Stream.Stream<R | R2, E | E2, A> => {
    const loop = (
      tokens: number,
      timestampMillis: number
    ): Channel.Channel<R2, E, Chunk.Chunk<A>, unknown, E | E2, Chunk.Chunk<A>, void> =>
      core.readWithCause(
        (input: Chunk.Chunk<A>) =>
          pipe(
            costFn(input),
            Effect.zip(Clock.currentTimeMillis()),
            Effect.map(([weight, currentTimeMillis]) => {
              const elapsed = currentTimeMillis - timestampMillis
              const cycles = elapsed / duration.millis
              const sum = tokens + (cycles * units)
              const max = units + burst < 0 ? Number.POSITIVE_INFINITY : units + burst
              const available = sum < 0 ? max : Math.min(sum, max)
              const remaining = available - weight
              const waitCycles = remaining >= 0 ? 0 : -remaining / units
              const delay = Duration.millis(Math.max(0, waitCycles * duration.millis))
              if (pipe(delay, Duration.greaterThan(Duration.zero))) {
                return pipe(
                  core.fromEffect(Clock.sleep(delay)),
                  channel.zipRight(core.write(input)),
                  core.flatMap(() => loop(remaining, currentTimeMillis))
                )
              }
              return pipe(
                core.write(input),
                core.flatMap(() => loop(remaining, currentTimeMillis))
              )
            }),
            channel.unwrap
          ),
        core.failCause,
        core.unit
      )
    const throttled = pipe(
      Clock.currentTimeMillis(),
      Effect.map((currentTimeMillis) => loop(units, currentTimeMillis)),
      channel.unwrap
    )
    return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(throttled)))
  }
)

/** @internal */
export const tick = (interval: Duration.Duration): Stream.Stream<never, never, void> =>
  repeatWithSchedule(void 0, Schedule.spaced(interval))

/** @internal */
export const timeout = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration) => Stream.Stream<R, E, A>,
  (duration: Duration.Duration) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(2, <R, E, A>(self: Stream.Stream<R, E, A>, duration: Duration.Duration): Stream.Stream<R, E, A> =>
  pipe(
    toPull(self),
    Effect.map(Effect.timeoutFail<Option.Option<E>>(() => Option.none(), duration)),
    fromPull
  ))

/** @internal */
export const timeoutFail = Debug.dual<
  <R, E, A, E2>(
    self: Stream.Stream<R, E, A>,
    error: LazyArg<E2>,
    duration: Duration.Duration
  ) => Stream.Stream<R, E2 | E, A>,
  <E2>(
    error: LazyArg<E2>,
    duration: Duration.Duration
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2 | E, A>
>(
  3,
  <R, E, A, E2>(
    self: Stream.Stream<R, E, A>,
    error: LazyArg<E2>,
    duration: Duration.Duration
  ): Stream.Stream<R, E | E2, A> => pipe(self, timeoutTo(duration, failSync(error)))
)

/** @internal */
export const timeoutFailCause = Debug.dual<
  <R, E, A, E2>(
    self: Stream.Stream<R, E, A>,
    cause: LazyArg<Cause.Cause<E2>>,
    duration: Duration.Duration
  ) => Stream.Stream<R, E2 | E, A>,
  <E2>(
    cause: LazyArg<Cause.Cause<E2>>,
    duration: Duration.Duration
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E2 | E, A>
>(
  3,
  <R, E, A, E2>(
    self: Stream.Stream<R, E, A>,
    cause: LazyArg<Cause.Cause<E2>>,
    duration: Duration.Duration
  ): Stream.Stream<R, E | E2, A> =>
    pipe(
      toPull(self),
      Effect.map(
        Effect.timeoutFailCause<Option.Option<E | E2>>(
          () => pipe(cause(), Cause.map(Option.some)),
          duration
        )
      ),
      fromPull
    )
)

/** @internal */
export const timeoutTo = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    duration: Duration.Duration,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2 | A>,
  <R2, E2, A2>(
    duration: Duration.Duration,
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2 | A>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    duration: Duration.Duration,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A | A2> => {
    const StreamTimeout = Cause.RuntimeException("Stream Timeout")
    return pipe(
      self,
      timeoutFailCause<E | E2>(() => Cause.die(StreamTimeout), duration),
      catchSomeCause((annotatedCause) => {
        const cause = Cause.unannotate(annotatedCause)
        return Cause.isDieType(cause) &&
            Cause.isRuntimeException(cause.defect) &&
            cause.defect.message !== undefined &&
            cause.defect.message === "Stream Timeout" ?
          Option.some(that) :
          Option.none()
      })
    )
  }
)

/** @internal */
export const toHub = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    capacity: number
  ) => Effect.Effect<Scope.Scope | R, never, Hub.Hub<Take.Take<E, A>>>,
  (
    capacity: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, Hub.Hub<Take.Take<E, A>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      capacity: number
    ): Effect.Effect<R | Scope.Scope, never, Hub.Hub<Take.Take<E, A>>> =>
      pipe(
        Effect.acquireRelease(Hub.bounded<Take.Take<E, A>>(capacity), (hub) => Hub.shutdown(hub)),
        Effect.tap((hub) => pipe(self, runIntoHubScoped(hub), Effect.forkScoped))
      ).traced(trace)
)

/** @internal */
export const toPull = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    self: Stream.Stream<R, E, A>
  ): Effect.Effect<R | Scope.Scope, never, Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>> =>
    pipe(
      channel.toPull(self.channel),
      Effect.map((pull) =>
        pipe(
          pull,
          Effect.mapError(Option.some),
          Effect.flatMap(Either.match(() => Effect.fail(Option.none()), Effect.succeed))
        )
      )
    ).traced(trace)
)

/** @internal */
export const toQueue = Debug.methodWithTrace(
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> => toQueueCapacity(self, 2).traced(trace)
)

/** @internal */
export const toQueueCapacity = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    capacity: number
  ) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Take.Take<E, A>>>,
  (
    capacity: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Take.Take<E, A>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      capacity: number
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
      pipe(
        Effect.acquireRelease(Queue.bounded<Take.Take<E, A>>(capacity), (queue) => Queue.shutdown(queue)),
        Effect.tap((queue) => pipe(self, runIntoQueueScoped(queue), Effect.forkScoped))
      ).traced(trace)
)

/** @internal */
export const toQueueDropping = Debug.methodWithTrace(
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
      toQueueDroppingCapacity(self, 2).traced(trace)
)

/** @internal */
export const toQueueDroppingCapacity = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    capacity: number
  ) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Take.Take<E, A>>>,
  (
    capacity: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Take.Take<E, A>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      capacity: number
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
      pipe(
        Effect.acquireRelease(Queue.dropping<Take.Take<E, A>>(capacity), (queue) => Queue.shutdown(queue)),
        Effect.tap((queue) => pipe(self, runIntoQueueScoped(queue), Effect.forkScoped))
      ).traced(trace)
)

/** @internal */
export const toQueueOfElements = Debug.methodWithTrace(
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>> =>
      toQueueOfElementsCapacity(self, 2).traced(trace)
)

/** @internal */
export const toQueueOfElementsCapacity = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    capacity: number
  ) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>>,
  (
    capacity: number
  ) => <R, E, A>(
    self: Stream.Stream<R, E, A>
  ) => Effect.Effect<Scope.Scope | R, never, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      capacity: number
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Exit.Exit<Option.Option<E>, A>>> =>
      pipe(
        Effect.acquireRelease(
          Queue.bounded<Exit.Exit<Option.Option<E>, A>>(capacity),
          (queue) => Queue.shutdown(queue)
        ),
        Effect.tap((queue) => pipe(self, runIntoQueueElementsScoped(queue), Effect.forkScoped))
      ).traced(trace)
)

/** @internal */
export const toQueueSliding = Debug.methodWithTrace((trace) =>
  <R, E, A>(
    self: Stream.Stream<R, E, A>
  ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
    toQueueSlidingCapacity(self, 2).traced(trace)
)

/** @internal */
export const toQueueSlidingCapacity = Debug.dualWithTrace<
  <R, E, A>(
    self: Stream.Stream<R, E, A>,
    capacity: number
  ) => Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>>,
  (
    capacity: number
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>>
>(
  2,
  (trace) =>
    <R, E, A>(
      self: Stream.Stream<R, E, A>,
      capacity: number
    ): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
      pipe(
        Effect.acquireRelease(Queue.sliding<Take.Take<E, A>>(capacity), (queue) => Queue.shutdown(queue)),
        Effect.tap((queue) => pipe(self, runIntoQueueScoped(queue), Effect.forkScoped))
      ).traced(trace)
)

/** @internal */
export const toQueueUnbounded = Debug.methodWithTrace((trace) =>
  <R, E, A>(self: Stream.Stream<R, E, A>): Effect.Effect<R | Scope.Scope, never, Queue.Dequeue<Take.Take<E, A>>> =>
    pipe(
      Effect.acquireRelease(Queue.unbounded<Take.Take<E, A>>(), (queue) => Queue.shutdown(queue)),
      Effect.tap((queue) => pipe(self, runIntoQueueScoped(queue), Effect.forkScoped))
    ).traced(trace)
)

/** @internal */
export const transduce = Debug.dual<
  <R, E, R2, E2, A, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, A, Z>
  ) => Stream.Stream<R2 | R, E2 | E, Z>,
  <R2, E2, A, Z>(
    sink: Sink.Sink<R2, E2, A, A, Z>
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, Z>
>(
  2,
  <R, E, R2, E2, A, Z>(
    self: Stream.Stream<R, E, A>,
    sink: Sink.Sink<R2, E2, A, A, Z>
  ): Stream.Stream<R | R2, E | E2, Z> => {
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
              return pipe(core.write(Chunk.of(z)), core.flatMap(() => nextChannel))
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
)

/** @internal */
export const unfold = <S, A>(s: S, f: (s: S) => Option.Option<readonly [A, S]>): Stream.Stream<never, never, A> =>
  unfoldChunk(s, (s) => pipe(f(s), Option.map(([a, s]) => [Chunk.of(a), s])))

/** @internal */
export const unfoldChunk = <S, A>(
  s: S,
  f: (s: S) => Option.Option<readonly [Chunk.Chunk<A>, S]>
): Stream.Stream<never, never, A> => {
  const loop = (s: S): Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, unknown> =>
    pipe(f(s), Option.match(core.unit, ([chunk, s]) => pipe(core.write(chunk), core.flatMap(() => loop(s)))))
  return new StreamImpl(core.suspend(() => loop(s)))
}

/** @internal */
export const unfoldChunkEffect = <R, E, A, S>(
  s: S,
  f: (s: S) => Effect.Effect<R, E, Option.Option<readonly [Chunk.Chunk<A>, S]>>
): Stream.Stream<R, E, A> =>
  suspend(() => {
    const loop = (s: S): Channel.Channel<R, unknown, unknown, unknown, E, Chunk.Chunk<A>, unknown> =>
      pipe(
        f(s),
        Effect.map(Option.match(
          core.unit,
          ([chunk, s]) => pipe(core.write(chunk), core.flatMap(() => loop(s)))
        )),
        channel.unwrap
      )
    return new StreamImpl(loop(s))
  })

/** @internal */
export const unfoldEffect = <S, R, E, A>(
  s: S,
  f: (s: S) => Effect.Effect<R, E, Option.Option<readonly [A, S]>>
): Stream.Stream<R, E, A> =>
  unfoldChunkEffect(s, (s) => pipe(f(s), Effect.map(Option.map(([a, s]) => [Chunk.of(a), s]))))

/** @internal */
export const unit = (): Stream.Stream<never, never, void> => succeed(void 0)

/** @internal */
export const unwrap = <R, E, R2, E2, A>(
  effect: Effect.Effect<R, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<R | R2, E | E2, A> => flatten(fromEffect(effect))

/** @internal */
export const unwrapScoped = <R, E, R2, E2, A>(
  effect: Effect.Effect<R | Scope.Scope, E, Stream.Stream<R2, E2, A>>
): Stream.Stream<Exclude<R | Scope.Scope, Scope.Scope> | R2, E | E2, A> => flatten(scoped(effect))

/** @internal */
export const updateService = Debug.dual<
  <R, E, A, T extends Context.Tag<any>>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    f: (service: Context.Tag.Service<T>) => Context.Tag.Service<T>
  ) => Stream.Stream<T | R, E, A>,
  <T extends Context.Tag<any>>(
    tag: T,
    f: (service: Context.Tag.Service<T>) => Context.Tag.Service<T>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<T | R, E, A>
>(
  3,
  <R, E, A, T extends Context.Tag<any>>(
    self: Stream.Stream<R, E, A>,
    tag: T,
    f: (service: Context.Tag.Service<T>) => Context.Tag.Service<T>
  ): Stream.Stream<R | T, E, A> =>
    pipe(
      self,
      contramapContext((context) =>
        pipe(
          context,
          Context.add(tag, f(pipe(context, Context.unsafeGet(tag))))
        )
      )
    )
)

/** @internal */
export const when = Debug.dual<
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: LazyArg<boolean>) => Stream.Stream<R, E, A>,
  (predicate: LazyArg<boolean>) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R, E, A>
>(
  2,
  <R, E, A>(self: Stream.Stream<R, E, A>, predicate: LazyArg<boolean>): Stream.Stream<R, E, A> =>
    pipe(self, whenEffect(Effect.sync(predicate)))
)

/** @internal */
export const whenCase = <A, R, E, A2>(
  evaluate: LazyArg<A>,
  pf: (a: A) => Option.Option<Stream.Stream<R, E, A2>>
) => whenCaseEffect(pf)(Effect.sync(evaluate))

/** @internal */
export const whenCaseEffect = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Effect.Effect<R, E, A>,
    pf: (a: A) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <A, R2, E2, A2>(
    pf: (a: A) => Option.Option<Stream.Stream<R2, E2, A2>>
  ) => <R, E>(self: Effect.Effect<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Effect.Effect<R, E, A>,
    pf: (a: A) => Option.Option<Stream.Stream<R2, E2, A2>>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    pipe(
      fromEffect(self),
      flatMap((a) => pipe(pf(a), Option.getOrElse(() => empty)))
    )
)

/** @internal */
export const whenEffect = Debug.dual<
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, boolean>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2>(
    effect: Effect.Effect<R2, E2, boolean>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2>(
    self: Stream.Stream<R, E, A>,
    effect: Effect.Effect<R2, E2, boolean>
  ): Stream.Stream<R | R2, E | E2, A> => pipe(fromEffect(effect), flatMap((bool) => bool ? self : empty))
)

/** @internal */
export const zip = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, readonly [A, A2]> => pipe(self, zipWith(that, (a, a2) => [a, a2]))
)

/** @internal */
export const zipFlatten = Debug.dual<
  <R, E, A extends ReadonlyArray<any>, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [...A, A2]>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A extends ReadonlyArray<any>>(
    self: Stream.Stream<R, E, A>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [...A, A2]>
>(
  2,
  <R, E, A extends ReadonlyArray<any>, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, readonly [...A, A2]> => pipe(self, zipWith(that, (a, a2) => [...a, a2]))
)

/** @internal */
export const zipAll = Debug.dual<
  <R, E, R2, E2, A2, A>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A,
    defaultRight: A2
  ) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>,
  <R2, E2, A2, A>(
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A,
    defaultRight: A2
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>
>(
  4,
  <R, E, R2, E2, A2, A>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A,
    defaultRight: A2
  ): Stream.Stream<R | R2, E | E2, readonly [A, A2]> =>
    pipe(
      self,
      zipAllWith(that, (a) => [a, defaultRight], (a2) => [defaultLeft, a2], (a, a2) => [a, a2])
    )
)

/** @internal */
export const zipAllLeft = Debug.dual<
  <R, E, R2, E2, A2, A>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A2, A>(
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  3,
  <R, E, R2, E2, A2, A>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultLeft: A
  ): Stream.Stream<R | R2, E | E2, A> => pipe(self, zipAllWith(that, identity, () => defaultLeft, (a) => a))
)

/** @internal */
export const zipAllRight = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultRight: A2
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>,
    defaultRight: A2
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  3,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    defaultRight: A2
  ): Stream.Stream<R | R2, E | E2, A2> => pipe(self, zipAllWith(that, () => defaultRight, identity, (_, a2) => a2))
)

/** @internal */
export const zipAllSortedByKey = Debug.dual<
  <R, E, R2, E2, A2, A, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    defaultRight: A2,
    order: Order.Order<K>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [K, readonly [A, A2]]>,
  <R2, E2, A2, A, K>(
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    defaultRight: A2,
    order: Order.Order<K>
  ) => <R, E>(
    self: Stream.Stream<R, E, readonly [K, A]>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [K, readonly [A, A2]]>
>(
  5,
  <R, E, R2, E2, A2, A, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    defaultRight: A2,
    order: Order.Order<K>
  ): Stream.Stream<R | R2, E | E2, readonly [K, readonly [A, A2]]> =>
    zipAllSortedByKeyWith(
      self,
      that,
      (a) => [a, defaultRight] as const,
      (a2) => [defaultLeft, a2] as const,
      (a, a2) => [a, a2] as const,
      order
    )
)

/** @internal */
export const zipAllSortedByKeyLeft = Debug.dual<
  <R, E, R2, E2, A2, A, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    order: Order.Order<K>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [K, A]>,
  <R2, E2, A2, A, K>(
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    order: Order.Order<K>
  ) => <R, E>(self: Stream.Stream<R, E, readonly [K, A]>) => Stream.Stream<R2 | R, E2 | E, readonly [K, A]>
>(
  4,
  <R, E, R2, E2, A2, A, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultLeft: A,
    order: Order.Order<K>
  ): Stream.Stream<R | R2, E | E2, readonly [K, A]> =>
    zipAllSortedByKeyWith(self, that, identity, () => defaultLeft, (a) => a, order)
)

/** @internal */
export const zipAllSortedByKeyRight = Debug.dual<
  <R, E, A, R2, E2, A2, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultRight: A2,
    order: Order.Order<K>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [K, A2]>,
  <R2, E2, A2, K>(
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultRight: A2,
    order: Order.Order<K>
  ) => <R, E, A>(self: Stream.Stream<R, E, readonly [K, A]>) => Stream.Stream<R2 | R, E2 | E, readonly [K, A2]>
>(
  4,
  <R, E, A, R2, E2, A2, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    defaultRight: A2,
    order: Order.Order<K>
  ): Stream.Stream<R | R2, E | E2, readonly [K, A2]> =>
    zipAllSortedByKeyWith(self, that, () => defaultRight, identity, (_, a2) => a2, order)
)

/** @internal */
export const zipAllSortedByKeyWith = Debug.dual<
  <R, E, R2, E2, A, A3, A2, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3,
    order: Order.Order<K>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [K, A3]>,
  <R2, E2, A, A3, A2, K>(
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3,
    order: Order.Order<K>
  ) => <R, E>(self: Stream.Stream<R, E, readonly [K, A]>) => Stream.Stream<R2 | R, E2 | E, readonly [K, A3]>
>(
  6,
  <R, E, R2, E2, A, A3, A2, K>(
    self: Stream.Stream<R, E, readonly [K, A]>,
    that: Stream.Stream<R2, E2, readonly [K, A2]>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3,
    order: Order.Order<K>
  ): Stream.Stream<R | R2, E | E2, readonly [K, A3]> => {
    const pull = (
      state: ZipAllState.ZipAllState<readonly [K, A], readonly [K, A2]>,
      pullLeft: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<readonly [K, A]>>,
      pullRight: Effect.Effect<R2, Option.Option<E2>, Chunk.Chunk<readonly [K, A2]>>
    ): Effect.Effect<
      R | R2,
      never,
      Exit.Exit<
        Option.Option<E | E2>,
        readonly [
          Chunk.Chunk<readonly [K, A3]>,
          ZipAllState.ZipAllState<readonly [K, A], readonly [K, A2]>
        ]
      >
    > => {
      switch (state._tag) {
        case ZipAllState.OP_DRAIN_LEFT: {
          return pipe(
            pullLeft,
            Effect.match(
              Exit.fail,
              (leftChunk) =>
                Exit.succeed(
                  [
                    pipe(leftChunk, Chunk.map(([k, a]) => [k, left(a)] as const)),
                    ZipAllState.DrainLeft
                  ] as const
                )
            )
          )
        }
        case ZipAllState.OP_DRAIN_RIGHT: {
          return pipe(
            pullRight,
            Effect.match(
              Exit.fail,
              (rightChunk) =>
                Exit.succeed(
                  [
                    pipe(rightChunk, Chunk.map(([k, a2]) => [k, right(a2)] as const)),
                    ZipAllState.DrainRight
                  ] as const
                )
            )
          )
        }
        case ZipAllState.OP_PULL_BOTH: {
          return pipe(
            Effect.unsome(pullLeft),
            Effect.zipPar(Effect.unsome(pullRight)),
            Effect.matchEffect(
              (error) => Effect.succeed(Exit.fail(Option.some(error))),
              ([leftOption, rightOption]) => {
                if (Option.isSome(leftOption) && Option.isSome(rightOption)) {
                  if (Chunk.isEmpty(leftOption.value) && Chunk.isEmpty(rightOption.value)) {
                    return pull(ZipAllState.PullBoth, pullLeft, pullRight)
                  }
                  if (Chunk.isEmpty(leftOption.value)) {
                    return pull(ZipAllState.PullLeft(rightOption.value), pullLeft, pullRight)
                  }
                  if (Chunk.isEmpty(rightOption.value)) {
                    return pull(ZipAllState.PullRight(leftOption.value), pullLeft, pullRight)
                  }
                  return Effect.succeed(Exit.succeed(merge(leftOption.value, rightOption.value)))
                }
                if (Option.isSome(leftOption) && Option.isNone(rightOption)) {
                  if (Chunk.isEmpty(leftOption.value)) {
                    return pull(ZipAllState.DrainLeft, pullLeft, pullRight)
                  }
                  return Effect.succeed(
                    Exit.succeed(
                      [
                        pipe(leftOption.value, Chunk.map(([k, a]) => [k, left(a)] as const)),
                        ZipAllState.DrainLeft
                      ] as const
                    )
                  )
                }
                if (Option.isNone(leftOption) && Option.isSome(rightOption)) {
                  if (Chunk.isEmpty(rightOption.value)) {
                    return pull(ZipAllState.DrainRight, pullLeft, pullRight)
                  }
                  return Effect.succeed(
                    Exit.succeed(
                      [
                        pipe(rightOption.value, Chunk.map(([k, a2]) => [k, right(a2)] as const)),
                        ZipAllState.DrainRight
                      ] as const
                    )
                  )
                }
                return Effect.succeed(Exit.fail<Option.Option<E | E2>>(Option.none()))
              }
            )
          )
        }
        case ZipAllState.OP_PULL_LEFT: {
          return pipe(
            pullLeft,
            Effect.matchEffect(
              Option.match(
                () =>
                  Effect.succeed(
                    Exit.succeed([
                      pipe(state.rightChunk, Chunk.map(([k, a2]) => [k, right(a2)] as const)),
                      ZipAllState.DrainRight
                    ])
                  ),
                (error) =>
                  Effect.succeed<
                    Exit.Exit<
                      Option.Option<E | E2>,
                      readonly [
                        Chunk.Chunk<readonly [K, A3]>,
                        ZipAllState.ZipAllState<readonly [K, A], readonly [K, A2]>
                      ]
                    >
                  >(Exit.fail(Option.some(error)))
              ),
              (leftChunk) =>
                Chunk.isEmpty(leftChunk) ?
                  pull(ZipAllState.PullLeft(state.rightChunk), pullLeft, pullRight) :
                  Effect.succeed(Exit.succeed(merge(leftChunk, state.rightChunk)))
            )
          )
        }
        case ZipAllState.OP_PULL_RIGHT: {
          return pipe(
            pullRight,
            Effect.matchEffect(
              Option.match(
                () =>
                  Effect.succeed(
                    Exit.succeed(
                      [
                        pipe(state.leftChunk, Chunk.map(([k, a]) => [k, left(a)] as const)),
                        ZipAllState.DrainLeft
                      ] as const
                    )
                  ),
                (error) =>
                  Effect.succeed<
                    Exit.Exit<
                      Option.Option<E | E2>,
                      readonly [
                        Chunk.Chunk<readonly [K, A3]>,
                        ZipAllState.ZipAllState<readonly [K, A], readonly [K, A2]>
                      ]
                    >
                  >(Exit.fail(Option.some(error)))
              ),
              (rightChunk) =>
                Chunk.isEmpty(rightChunk) ?
                  pull(ZipAllState.PullRight(state.leftChunk), pullLeft, pullRight) :
                  Effect.succeed(Exit.succeed(merge(state.leftChunk, rightChunk)))
            )
          )
        }
      }
    }
    const merge = (
      leftChunk: Chunk.Chunk<readonly [K, A]>,
      rightChunk: Chunk.Chunk<readonly [K, A2]>
    ): readonly [
      Chunk.Chunk<readonly [K, A3]>,
      ZipAllState.ZipAllState<readonly [K, A], readonly [K, A2]>
    ] => {
      const hasNext = <T>(chunk: Chunk.Chunk<T>, index: number) => index < chunk.length - 1
      const builder: Array<readonly [K, A3]> = []
      let state:
        | ZipAllState.ZipAllState<
          readonly [K, A],
          readonly [K, A2]
        >
        | undefined = undefined
      let leftIndex = 0
      let rightIndex = 0
      let leftTuple = pipe(leftChunk, Chunk.unsafeGet(leftIndex))
      let rightTuple = pipe(rightChunk, Chunk.unsafeGet(rightIndex))
      let k1 = leftTuple[0]
      let a = leftTuple[1]
      let k2 = rightTuple[0]
      let a2 = rightTuple[1]
      let loop = true
      while (loop) {
        const compare = order.compare(k1, k2)
        if (compare === 0) {
          builder.push([k1, both(a, a2)])
          if (hasNext(leftChunk, leftIndex) && hasNext(rightChunk, rightIndex)) {
            leftIndex = leftIndex + 1
            rightIndex = rightIndex + 1
            leftTuple = pipe(leftChunk, Chunk.unsafeGet(leftIndex))
            rightTuple = pipe(rightChunk, Chunk.unsafeGet(rightIndex))
            k1 = leftTuple[0]
            a = leftTuple[1]
            k2 = rightTuple[0]
            a2 = rightTuple[1]
          } else if (hasNext(leftChunk, leftIndex)) {
            state = ZipAllState.PullRight(pipe(leftChunk, Chunk.drop(leftIndex + 1)))
            loop = false
          } else if (hasNext(rightChunk, rightIndex)) {
            state = ZipAllState.PullLeft(pipe(rightChunk, Chunk.drop(rightIndex + 1)))
            loop = false
          } else {
            state = ZipAllState.PullBoth
            loop = false
          }
        } else if (compare < 0) {
          builder.push([k1, left(a)] as const)
          if (hasNext(leftChunk, leftIndex)) {
            leftIndex = leftIndex + 1
            leftTuple = pipe(leftChunk, Chunk.unsafeGet(leftIndex))
            k1 = leftTuple[0]
            a = leftTuple[1]
          } else {
            const rightBuilder: Array<readonly [K, A2]> = []
            rightBuilder.push(rightTuple)
            while (hasNext(rightChunk, rightIndex)) {
              rightIndex = rightIndex + 1
              rightTuple = pipe(rightChunk, Chunk.unsafeGet(rightIndex))
              rightBuilder.push(rightTuple)
            }
            state = ZipAllState.PullLeft(Chunk.unsafeFromArray(rightBuilder))
            loop = false
          }
        } else {
          builder.push([k2, right(a2)] as const)
          if (hasNext(rightChunk, rightIndex)) {
            rightIndex = rightIndex + 1
            rightTuple = pipe(rightChunk, Chunk.unsafeGet(rightIndex))
            k2 = rightTuple[0]
            a2 = rightTuple[1]
          } else {
            const leftBuilder: Array<readonly [K, A]> = []
            leftBuilder.push(leftTuple)
            while (hasNext(leftChunk, leftIndex)) {
              leftIndex = leftIndex + 1
              leftTuple = pipe(leftChunk, Chunk.unsafeGet(leftIndex))
              leftBuilder.push(leftTuple)
            }
            state = ZipAllState.PullRight(Chunk.unsafeFromArray(leftBuilder))
            loop = false
          }
        }
      }
      return [Chunk.unsafeFromArray(builder), state!] as const
    }
    return pipe(
      self,
      combineChunks(that, ZipAllState.PullBoth, pull)
    )
  }
)

/** @internal */
export const zipAllWith = Debug.dual<
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3
  ) => Stream.Stream<R2 | R, E2 | E, A3>,
  <R2, E2, A2, A, A3>(
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3>
>(
  5,
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    left: (a: A) => A3,
    right: (a2: A2) => A3,
    both: (a: A, a2: A2) => A3
  ): Stream.Stream<R | R2, E | E2, A3> => {
    const pull = (
      state: ZipAllState.ZipAllState<A, A2>,
      pullLeft: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>,
      pullRight: Effect.Effect<R2, Option.Option<E2>, Chunk.Chunk<A2>>
    ): Effect.Effect<
      R | R2,
      never,
      Exit.Exit<Option.Option<E | E2>, readonly [Chunk.Chunk<A3>, ZipAllState.ZipAllState<A, A2>]>
    > => {
      switch (state._tag) {
        case ZipAllState.OP_DRAIN_LEFT: {
          return pipe(
            pullLeft,
            Effect.matchEffect(
              (error) => Effect.succeed(Exit.fail(error)),
              (leftChunk) =>
                Effect.succeed(Exit.succeed(
                  [
                    pipe(leftChunk, Chunk.map(left)),
                    ZipAllState.DrainLeft
                  ] as const
                ))
            )
          )
        }
        case ZipAllState.OP_DRAIN_RIGHT: {
          return pipe(
            pullRight,
            Effect.matchEffect(
              (error) => Effect.succeed(Exit.fail(error)),
              (rightChunk) =>
                Effect.succeed(Exit.succeed(
                  [
                    pipe(rightChunk, Chunk.map(right)),
                    ZipAllState.DrainRight
                  ] as const
                ))
            )
          )
        }
        case ZipAllState.OP_PULL_BOTH: {
          return pipe(
            Effect.unsome(pullLeft),
            Effect.zipPar(Effect.unsome(pullRight)),
            Effect.matchEffect(
              (error) => Effect.succeed(Exit.fail(Option.some(error))),
              ([leftOption, rightOption]) => {
                if (Option.isSome(leftOption) && Option.isSome(rightOption)) {
                  if (Chunk.isEmpty(leftOption.value) && Chunk.isEmpty(rightOption.value)) {
                    return pull(ZipAllState.PullBoth, pullLeft, pullRight)
                  }
                  if (Chunk.isEmpty(leftOption.value)) {
                    return pull(ZipAllState.PullLeft(rightOption.value), pullLeft, pullRight)
                  }
                  if (Chunk.isEmpty(rightOption.value)) {
                    return pull(ZipAllState.PullRight(leftOption.value), pullLeft, pullRight)
                  }
                  return Effect.succeed(Exit.succeed(zip(leftOption.value, rightOption.value, both)))
                }
                if (Option.isSome(leftOption) && Option.isNone(rightOption)) {
                  return Effect.succeed(Exit.succeed(
                    [
                      pipe(leftOption.value, Chunk.map(left)),
                      ZipAllState.DrainLeft
                    ] as const
                  ))
                }
                if (Option.isNone(leftOption) && Option.isSome(rightOption)) {
                  return Effect.succeed(Exit.succeed(
                    [
                      pipe(rightOption.value, Chunk.map(right)),
                      ZipAllState.DrainRight
                    ] as const
                  ))
                }
                return Effect.succeed(Exit.fail<Option.Option<E | E2>>(Option.none()))
              }
            )
          )
        }
        case ZipAllState.OP_PULL_LEFT: {
          return pipe(
            pullLeft,
            Effect.matchEffect(
              Option.match(
                () =>
                  Effect.succeed(Exit.succeed(
                    [
                      pipe(state.rightChunk, Chunk.map(right)),
                      ZipAllState.DrainRight
                    ] as const
                  )),
                (error) =>
                  Effect.succeed<
                    Exit.Exit<Option.Option<E | E2>, readonly [Chunk.Chunk<A3>, ZipAllState.ZipAllState<A, A2>]>
                  >(
                    Exit.fail(Option.some(error))
                  )
              ),
              (leftChunk) => {
                if (Chunk.isEmpty(leftChunk)) {
                  return pull(ZipAllState.PullLeft(state.rightChunk), pullLeft, pullRight)
                }
                if (Chunk.isEmpty(state.rightChunk)) {
                  return pull(ZipAllState.PullRight(leftChunk), pullLeft, pullRight)
                }
                return Effect.succeed(Exit.succeed(zip(leftChunk, state.rightChunk, both)))
              }
            )
          )
        }
        case ZipAllState.OP_PULL_RIGHT: {
          return pipe(
            pullRight,
            Effect.matchEffect(
              Option.match(
                () =>
                  Effect.succeed(
                    Exit.succeed(
                      [
                        pipe(state.leftChunk, Chunk.map(left)),
                        ZipAllState.DrainLeft
                      ] as const
                    )
                  ),
                (error) =>
                  Effect.succeed<
                    Exit.Exit<Option.Option<E | E2>, readonly [Chunk.Chunk<A3>, ZipAllState.ZipAllState<A, A2>]>
                  >(
                    Exit.fail(Option.some(error))
                  )
              ),
              (rightChunk) => {
                if (Chunk.isEmpty(rightChunk)) {
                  return pull(
                    ZipAllState.PullRight(state.leftChunk),
                    pullLeft,
                    pullRight
                  )
                }
                if (Chunk.isEmpty(state.leftChunk)) {
                  return pull(
                    ZipAllState.PullLeft(rightChunk),
                    pullLeft,
                    pullRight
                  )
                }
                return Effect.succeed(Exit.succeed(zip(state.leftChunk, rightChunk, both)))
              }
            )
          )
        }
      }
    }
    const zip = (
      leftChunk: Chunk.Chunk<A>,
      rightChunk: Chunk.Chunk<A2>,
      f: (a: A, a2: A2) => A3
    ): readonly [Chunk.Chunk<A3>, ZipAllState.ZipAllState<A, A2>] => {
      const [output, either] = zipChunks(leftChunk, rightChunk, f)
      switch (either._tag) {
        case "Left": {
          if (Chunk.isEmpty(either.left)) {
            return [output, ZipAllState.PullBoth] as const
          }
          return [output, ZipAllState.PullRight(either.left)] as const
        }
        case "Right": {
          if (Chunk.isEmpty(either.right)) {
            return [output, ZipAllState.PullBoth] as const
          }
          return [output, ZipAllState.PullLeft(either.right)] as const
        }
      }
    }
    return pipe(
      self,
      combineChunks(that, ZipAllState.PullBoth, pull)
    )
  }
)

/** @internal */
export const zipLatest = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, readonly [A, A2]>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, readonly [A, A2]> => pipe(self, zipLatestWith(that, (a, a2) => [a, a2]))
)

/** @internal */
export const zipLatestWith = Debug.dual<
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ) => Stream.Stream<R2 | R, E2 | E, A3>,
  <R2, E2, A2, A, A3>(
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3>
>(
  3,
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ): Stream.Stream<R | R2, E | E2, A3> => {
    const pullNonEmpty = <_R, _E, _A>(
      pull: Effect.Effect<_R, Option.Option<_E>, Chunk.Chunk<_A>>
    ): Effect.Effect<_R, Option.Option<_E>, Chunk.Chunk<_A>> =>
      pipe(pull, Effect.flatMap((chunk) => Chunk.isEmpty(chunk) ? pullNonEmpty(pull) : Effect.succeed(chunk)))
    return pipe(
      toPull(self),
      Effect.map(pullNonEmpty),
      Effect.zip(pipe(toPull(that), Effect.map(pullNonEmpty))),
      Effect.flatMap(([left, right]) =>
        pipe(
          fromEffectOption<R | R2, E | E2, readonly [Chunk.Chunk<A>, Chunk.Chunk<A2>, boolean]>(
            pipe(
              left,
              Effect.raceWith(
                right,
                (leftDone, rightFiber) =>
                  pipe(
                    Effect.done(leftDone),
                    Effect.zipWith(Fiber.join(rightFiber), (l, r) => [l, r, true] as const)
                  ),
                (rightDone, leftFiber) =>
                  pipe(
                    Effect.done(rightDone),
                    Effect.zipWith(Fiber.join(leftFiber), (l, r) => [r, l, false] as const)
                  )
              )
            )
          ),
          flatMap(([l, r, leftFirst]) =>
            pipe(
              fromEffect(
                Ref.make([Chunk.unsafeLast(l), Chunk.unsafeLast(r)] as const)
              ),
              flatMap((latest) =>
                pipe(
                  fromChunk(
                    leftFirst ?
                      pipe(r, Chunk.map((a2) => f(Chunk.unsafeLast(l), a2))) :
                      pipe(l, Chunk.map((a) => f(a, Chunk.unsafeLast(r))))
                  ),
                  concat(
                    pipe(
                      repeatEffectOption(left),
                      mergeEither(repeatEffectOption(right)),
                      mapEffect(Either.match(
                        (leftChunk) =>
                          pipe(
                            Ref.modify(latest, ([_, rightLatest]) =>
                              [
                                pipe(leftChunk, Chunk.map((a) => f(a, rightLatest))),
                                [Chunk.unsafeLast(leftChunk), rightLatest] as const
                              ] as const)
                          ),
                        (rightChunk) =>
                          pipe(
                            Ref.modify(latest, ([leftLatest, _]) =>
                              [
                                pipe(rightChunk, Chunk.map((a2) => f(leftLatest, a2))),
                                [leftLatest, Chunk.unsafeLast(rightChunk)] as const
                              ] as const)
                          )
                      )),
                      flatMap(fromChunk)
                    )
                  )
                )
              )
            )
          ),
          toPull
        )
      ),
      fromPull
    )
  }
)

/** @internal */
export const zipLeft = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      self,
      zipWithChunks(that, (left, right) => {
        if (left.length > right.length) {
          return [
            pipe(left, Chunk.take(right.length)),
            Either.left(pipe(left, Chunk.take(right.length)))
          ] as const
        }
        return [
          left,
          Either.right(pipe(right, Chunk.drop(left.length)))
        ]
      })
    )
)

/** @internal */
export const zipRight = Debug.dual<
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ) => Stream.Stream<R2 | R, E2 | E, A2>,
  <R2, E2, A2>(
    that: Stream.Stream<R2, E2, A2>
  ) => <R, E, A>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A2>
>(
  2,
  <R, E, A, R2, E2, A2>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>
  ): Stream.Stream<R | R2, E | E2, A2> =>
    pipe(
      self,
      zipWithChunks(that, (left, right) => {
        if (left.length > right.length) {
          return [
            right,
            Either.left(pipe(left, Chunk.take(right.length)))
          ] as const
        }
        return [
          pipe(right, Chunk.take(left.length)),
          Either.right(pipe(right, Chunk.drop(left.length)))
        ]
      })
    )
)

/** @internal */
export const zipWith = Debug.dual<
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ) => Stream.Stream<R2 | R, E2 | E, A3>,
  <R2, E2, A2, A, A3>(
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3>
>(
  3,
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    f: (a: A, a2: A2) => A3
  ): Stream.Stream<R | R2, E | E2, A3> =>
    pipe(self, zipWithChunks(that, (leftChunk, rightChunk) => zipChunks(leftChunk, rightChunk, f)))
)

/** @internal */
export const zipWithChunks = Debug.dual<
  <R, E, R2, E2, A2, A, A3>(
    self: Stream.Stream<R, E, A>,
    that: Stream.Stream<R2, E2, A2>,
    f: (
      left: Chunk.Chunk<A>,
      right: Chunk.Chunk<A2>
    ) => readonly [Chunk.Chunk<A3>, Either.Either<Chunk.Chunk<A>, Chunk.Chunk<A2>>]
  ) => Stream.Stream<R2 | R, E2 | E, A3>,
  <R2, E2, A2, A, A3>(
    that: Stream.Stream<R2, E2, A2>,
    f: (
      left: Chunk.Chunk<A>,
      right: Chunk.Chunk<A2>
    ) => readonly [Chunk.Chunk<A3>, Either.Either<Chunk.Chunk<A>, Chunk.Chunk<A2>>]
  ) => <R, E>(self: Stream.Stream<R, E, A>) => Stream.Stream<R2 | R, E2 | E, A3>
>(3, <R, E, R2, E2, A2, A, A3>(
  self: Stream.Stream<R, E, A>,
  that: Stream.Stream<R2, E2, A2>,
  f: (
    left: Chunk.Chunk<A>,
    right: Chunk.Chunk<A2>
  ) => readonly [Chunk.Chunk<A3>, Either.Either<Chunk.Chunk<A>, Chunk.Chunk<A2>>]
): Stream.Stream<R | R2, E | E2, A3> => {
  const pull = (
    state: ZipChunksState.ZipChunksState<A, A2>,
    pullLeft: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>,
    pullRight: Effect.Effect<R2, Option.Option<E2>, Chunk.Chunk<A2>>
  ): Effect.Effect<
    R | R2,
    never,
    Exit.Exit<Option.Option<E | E2>, readonly [Chunk.Chunk<A3>, ZipChunksState.ZipChunksState<A, A2>]>
  > => {
    switch (state._tag) {
      case ZipChunksState.OP_PULL_BOTH: {
        return pipe(
          Effect.unsome(pullLeft),
          Effect.zipPar(Effect.unsome(pullRight)),
          Effect.matchEffect(
            (error) => Effect.succeed(Exit.fail(Option.some(error))),
            ([leftOption, rightOption]) => {
              if (Option.isSome(leftOption) && Option.isSome(rightOption)) {
                if (Chunk.isEmpty(leftOption.value) && Chunk.isEmpty(rightOption.value)) {
                  return pull(ZipChunksState.PullBoth, pullLeft, pullRight)
                }
                if (Chunk.isEmpty(leftOption.value)) {
                  return pull(ZipChunksState.PullLeft(rightOption.value), pullLeft, pullRight)
                }
                if (Chunk.isEmpty(rightOption.value)) {
                  return pull(ZipChunksState.PullRight(leftOption.value), pullLeft, pullRight)
                }
                return Effect.succeed(Exit.succeed(zip(leftOption.value, rightOption.value)))
              }
              return Effect.succeed(Exit.fail(Option.none()))
            }
          )
        )
      }
      case ZipChunksState.OP_PULL_LEFT: {
        return pipe(
          pullLeft,
          Effect.matchEffect(
            (error) => Effect.succeed(Exit.fail(error)),
            (leftChunk) => {
              if (Chunk.isEmpty(leftChunk)) {
                return pull(ZipChunksState.PullLeft(state.rightChunk), pullLeft, pullRight)
              }
              if (Chunk.isEmpty(state.rightChunk)) {
                return pull(ZipChunksState.PullRight(leftChunk), pullLeft, pullRight)
              }
              return Effect.succeed(Exit.succeed(zip(leftChunk, state.rightChunk)))
            }
          )
        )
      }
      case ZipChunksState.OP_PULL_RIGHT: {
        return pipe(
          pullRight,
          Effect.matchEffect(
            (error) => Effect.succeed(Exit.fail(error)),
            (rightChunk) => {
              if (Chunk.isEmpty(rightChunk)) {
                return pull(ZipChunksState.PullRight(state.leftChunk), pullLeft, pullRight)
              }
              if (Chunk.isEmpty(state.leftChunk)) {
                return pull(ZipChunksState.PullLeft(rightChunk), pullLeft, pullRight)
              }
              return Effect.succeed(Exit.succeed(zip(state.leftChunk, rightChunk)))
            }
          )
        )
      }
    }
  }
  const zip = (
    leftChunk: Chunk.Chunk<A>,
    rightChunk: Chunk.Chunk<A2>
  ): readonly [Chunk.Chunk<A3>, ZipChunksState.ZipChunksState<A, A2>] => {
    const [output, either] = f(leftChunk, rightChunk)
    switch (either._tag) {
      case "Left": {
        if (Chunk.isEmpty(either.left)) {
          return [output, ZipChunksState.PullBoth] as const
        }
        return [output, ZipChunksState.PullRight(either.left)] as const
      }
      case "Right": {
        if (Chunk.isEmpty(either.right)) {
          return [output, ZipChunksState.PullBoth] as const
        }
        return [output, ZipChunksState.PullLeft(either.right)] as const
      }
    }
  }
  return pipe(
    self,
    combineChunks(that, ZipChunksState.PullBoth, pull)
  )
})

/** @internal */
export const zipWithIndex = <R, E, A>(self: Stream.Stream<R, E, A>): Stream.Stream<R, E, readonly [A, number]> =>
  pipe(self, mapAccum(0, (index, a) => [index + 1, [a, index] as const] as const))

/** @internal */
export const zipWithNext = <R, E, A>(
  self: Stream.Stream<R, E, A>
): Stream.Stream<R, E, readonly [A, Option.Option<A>]> => {
  const process = (
    last: Option.Option<A>
  ): Channel.Channel<never, never, Chunk.Chunk<A>, unknown, never, Chunk.Chunk<readonly [A, Option.Option<A>]>, void> =>
    core.readWithCause(
      (input: Chunk.Chunk<A>) => {
        const [newLast, chunk] = pipe(
          input,
          Chunk.mapAccum(
            last,
            (prev, curr) => [Option.some(curr), pipe(prev, Option.map((a) => [a, curr] as const))] as const
          )
        )
        const output = pipe(
          chunk,
          Chunk.filterMap((option) =>
            Option.isSome(option) ?
              Option.some([option.value[0], Option.some(option.value[1])] as const) :
              Option.none()
          )
        )
        return pipe(core.write(output), core.flatMap(() => process(newLast)))
      },
      core.failCause,
      () =>
        pipe(
          last,
          Option.match(
            core.unit,
            (value) =>
              pipe(
                core.write(Chunk.of<readonly [A, Option.Option<A>]>([value, Option.none()])),
                channel.zipRight(core.unit())
              )
          )
        )
    )
  return new StreamImpl(pipe(self.channel, channel.pipeToOrFail(process(Option.none()))))
}

/** @internal */
export const zipWithPrevious = <R, E, A>(
  self: Stream.Stream<R, E, A>
): Stream.Stream<R, E, readonly [Option.Option<A>, A]> =>
  pipe(
    self,
    mapAccum<Option.Option<A>, A, readonly [Option.Option<A>, A]>(
      Option.none(),
      (prev, curr) => [Option.some(curr), [prev, curr]]
    )
  )

/** @internal */
export const zipWithPreviousAndNext = <R, E, A>(
  self: Stream.Stream<R, E, A>
): Stream.Stream<R, E, readonly [Option.Option<A>, A, Option.Option<A>]> =>
  pipe(
    zipWithNext(zipWithPrevious(self)),
    map(([[prev, curr], next]) => [prev, curr, pipe(next, Option.map((tuple) => tuple[1]))] as const)
  )

/** @internal */
const zipChunks = <A, B, C>(
  left: Chunk.Chunk<A>,
  right: Chunk.Chunk<B>,
  f: (a: A, b: B) => C
): readonly [Chunk.Chunk<C>, Either.Either<Chunk.Chunk<A>, Chunk.Chunk<B>>] => {
  if (left.length > right.length) {
    return [
      pipe(left, Chunk.take(right.length), Chunk.zipWith(right, f)),
      Either.left(pipe(left, Chunk.drop(right.length)))
    ] as const
  }
  return [
    pipe(left, Chunk.zipWith(pipe(right, Chunk.take(left.length)), f)),
    Either.right(pipe(right, Chunk.drop(left.length)))
  ] as const
}

// Circular with Channel

/** @internal */
export const channelToStream = <Env, OutErr, OutElem, OutDone>(
  self: Channel.Channel<Env, unknown, unknown, unknown, OutErr, Chunk.Chunk<OutElem>, OutDone>
): Stream.Stream<Env, OutErr, OutElem> => {
  return new StreamImpl(self)
}
