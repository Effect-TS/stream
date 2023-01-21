import * as Cause from "@effect/io/Cause"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import type * as Channel from "@effect/stream/Channel"
import type * as GroupBy from "@effect/stream/GroupBy"
import * as channel from "@effect/stream/internal/channel"
import * as channelExecutor from "@effect/stream/internal/channel/channelExecutor"
import * as core from "@effect/stream/internal/core"
import * as stream from "@effect/stream/internal/stream"
import * as take from "@effect/stream/internal/take"
import type * as Stream from "@effect/stream/Stream"
import type * as Take from "@effect/stream/Take"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import type { Predicate } from "@fp-ts/data/Predicate"

/** @internal */
const GroupBySymbolKey = "@effect/stream/GroupBy"

/** @internal */
export const GroupByTypeId: GroupBy.GroupByTypeId = Symbol.for(
  GroupBySymbolKey
) as GroupBy.GroupByTypeId

/** @internal */
const groupByVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _,
  _K: (_: never) => _,
  _V: (_: never) => _
}

/** @internal */
export const evaluate = <K, E, V, R2, E2, A>(
  f: (key: K, stream: Stream.Stream<never, E, V>) => Stream.Stream<R2, E2, A>,
  bufferSize = 16
) => {
  return <R>(self: GroupBy.GroupBy<R, E, K, V>): Stream.Stream<R | R2, E | E2, A> =>
    pipe(
      self.grouped,
      stream.flatMapPar(Number.POSITIVE_INFINITY, bufferSize)(([key, queue]) =>
        f(key, stream.flattenTake(stream.fromQueueWithShutdown(queue)))
      )
    )
}

/** @internal */
export const filter = <K>(predicate: Predicate<K>) => {
  return <R, E, V>(self: GroupBy.GroupBy<R, E, K, V>): GroupBy.GroupBy<R, E, K, V> =>
    make(
      pipe(
        self.grouped,
        stream.filterEffect((tuple) => {
          if (predicate(tuple[0])) {
            return pipe(Effect.succeed(tuple), Effect.as(true))
          }
          return pipe(Queue.shutdown(tuple[1]), Effect.as(false))
        })
      )
    )
}

/** @internal */
export const first = (n: number) => {
  return <R, E, K, V>(self: GroupBy.GroupBy<R, E, K, V>): GroupBy.GroupBy<R, E, K, V> =>
    make(
      pipe(
        stream.zipWithIndex(self.grouped),
        stream.filterEffect((tuple) => {
          const index = tuple[1]
          const queue = tuple[0][1]
          if (index < n) {
            return pipe(Effect.succeed(tuple), Effect.as(true))
          }
          return pipe(Queue.shutdown(queue), Effect.as(false))
        }),
        stream.map((tuple) => tuple[0])
      )
    )
}

/** @internal */
export const make = <R, E, K, V>(
  grouped: Stream.Stream<R, E, readonly [K, Queue.Dequeue<Take.Take<E, V>>]>
): GroupBy.GroupBy<R, E, K, V> => ({
  [GroupByTypeId]: groupByVariance,
  grouped
})

// Circular with Stream

/** @internal */
export const groupBy = <A, R2, E2, K, V>(
  f: (a: A) => Effect.Effect<R2, E2, readonly [K, V]>,
  bufferSize = 16
) => {
  return <R, E>(self: Stream.Stream<R, E, A>): GroupBy.GroupBy<R | R2, E | E2, K, V> =>
    make(
      stream.unwrapScoped(
        Effect.gen(function*($) {
          const decider = yield* $(
            Deferred.make<
              never,
              (key: K, value: V) => Effect.Effect<never, never, Predicate<number>>
            >()
          )
          const output = yield* $(Effect.acquireRelease(
            Queue.bounded<Exit.Exit<Option.Option<E | E2>, readonly [K, Queue.Dequeue<Take.Take<E | E2, V>>]>>(
              bufferSize
            ),
            (queue) => Queue.shutdown(queue)
          ))
          const ref = yield* $(Ref.make<Map<K, number>>(new Map()))
          const add = yield* $(
            pipe(
              self,
              stream.mapEffect(f),
              stream.distributedWithDynamic(
                bufferSize,
                ([key, value]) => pipe(Deferred.await(decider), Effect.flatMap((f) => f(key, value))),
                (exit) => Queue.offer(output, exit)
              )
            )
          )
          yield* $(
            pipe(
              Deferred.succeed(decider, (key, _) =>
                pipe(
                  Ref.get(ref),
                  Effect.map((map) => Option.fromNullable(map.get(key))),
                  Effect.flatMap(Option.match(
                    () =>
                      pipe(
                        add,
                        Effect.flatMap(([index, queue]) =>
                          pipe(
                            Ref.update(ref, (map) => map.set(key, index)),
                            Effect.zipRight(
                              pipe(
                                Queue.offer(
                                  output,
                                  Exit.succeed(
                                    [
                                      key,
                                      mapDequeue(queue, (exit) =>
                                        new take.TakeImpl(pipe(
                                          exit,
                                          Exit.map((tuple) => Chunk.of(tuple[1]))
                                        )))
                                    ] as const
                                  )
                                ),
                                Effect.as<Predicate<number>>((n: number) => n === index)
                              )
                            )
                          )
                        )
                      ),
                    (index) => Effect.succeed<Predicate<number>>((n: number) => n === index)
                  ))
                ))
            )
          )
          return stream.flattenExitOption(stream.fromQueueWithShutdown(output))
        })
      )
    )
}

const mapDequeue = <A, B>(dequeue: Queue.Dequeue<A>, f: (a: A) => B): Queue.Dequeue<B> => new MapDequeue(dequeue, f)

class MapDequeue<A, B> implements Queue.Dequeue<B> {
  readonly [Queue.DequeueTypeId] = {
    _Out: (_: never) => _
  }

  constructor(
    readonly dequeue: Queue.Dequeue<A>,
    readonly f: (a: A) => B
  ) {
  }

  capacity(): number {
    return Queue.capacity(this.dequeue)
  }

  size(): Effect.Effect<never, never, number> {
    return Queue.size(this.dequeue)
  }

  awaitShutdown(): Effect.Effect<never, never, void> {
    return Queue.awaitShutdown(this.dequeue)
  }

  isShutdown(): Effect.Effect<never, never, boolean> {
    return Queue.isShutdown(this.dequeue)
  }

  shutdown(): Effect.Effect<never, never, void> {
    return Queue.shutdown(this.dequeue)
  }

  isFull(): Effect.Effect<never, never, boolean> {
    return Queue.isFull(this.dequeue)
  }

  isEmpty(): Effect.Effect<never, never, boolean> {
    return Queue.isEmpty(this.dequeue)
  }

  take(): Effect.Effect<never, never, B> {
    return pipe(Queue.take(this.dequeue), Effect.map((a) => this.f(a)))
  }

  takeAll(): Effect.Effect<never, never, Chunk.Chunk<B>> {
    return pipe(Queue.takeAll(this.dequeue), Effect.map(Chunk.map((a) => this.f(a))))
  }

  takeUpTo(max: number): Effect.Effect<never, never, Chunk.Chunk<B>> {
    return pipe(Queue.takeUpTo(this.dequeue, max), Effect.map(Chunk.map((a) => this.f(a))))
  }

  takeBetween(min: number, max: number): Effect.Effect<never, never, Chunk.Chunk<B>> {
    return pipe(Queue.takeBetween(this.dequeue, min, max), Effect.map(Chunk.map((a) => this.f(a))))
  }

  takeN(n: number): Effect.Effect<never, never, Chunk.Chunk<B>> {
    return pipe(Queue.takeN(this.dequeue, n), Effect.map(Chunk.map((a) => this.f(a))))
  }

  poll(): Effect.Effect<never, never, Option.Option<B>> {
    return pipe(Queue.poll(this.dequeue), Effect.map(Option.map((a) => this.f(a))))
  }
}

/** @internal */
export const groupByKey = <A, K>(f: (a: A) => K, bufferSize = 16) => {
  return <R, E>(self: Stream.Stream<R, E, A>): GroupBy.GroupBy<R, E, K, A> => {
    const loop = (
      map: Map<K, Queue.Queue<Take.Take<E, A>>>,
      outerQueue: Queue.Queue<Take.Take<E, readonly [K, Queue.Queue<Take.Take<E, A>>]>>
    ): Channel.Channel<R, E, Chunk.Chunk<A>, unknown, E, never, unknown> =>
      core.readWithCause(
        (input: Chunk.Chunk<A>) =>
          pipe(
            core.fromEffect(
              pipe(
                input,
                groupByIterable(f),
                Effect.forEachDiscard(([key, values]) => {
                  const innerQueue = map.get(key)
                  if (innerQueue === undefined) {
                    return pipe(
                      Queue.bounded<Take.Take<E, A>>(bufferSize),
                      Effect.flatMap((innerQueue) =>
                        pipe(
                          Effect.sync(() => {
                            map.set(key, innerQueue)
                          }),
                          Effect.zipRight(
                            Queue.offer(outerQueue, take.of([key, innerQueue] as const))
                          ),
                          Effect.zipRight(
                            pipe(
                              Queue.offer(innerQueue, take.chunk(values)),
                              Effect.catchSomeCause((cause) =>
                                Cause.isInterruptedOnly(cause) ?
                                  Option.some(Effect.unit()) :
                                  Option.none
                              )
                            )
                          )
                        )
                      )
                    )
                  }
                  return pipe(
                    Queue.offer(innerQueue, take.chunk(values)),
                    Effect.catchSomeCause((cause) =>
                      Cause.isInterruptedOnly(cause) ?
                        Option.some(Effect.unit()) :
                        Option.none
                    )
                  )
                })
              )
            ),
            core.flatMap(() => loop(map, outerQueue))
          ),
        (cause) => core.fromEffect(Queue.offer(outerQueue, take.failCause(cause))),
        () =>
          pipe(
            core.fromEffect(
              pipe(
                map.entries(),
                Effect.forEachDiscard(([_, innerQueue]) =>
                  pipe(
                    Queue.offer(innerQueue, take.end),
                    Effect.catchSomeCause((cause) =>
                      Cause.isInterruptedOnly(cause) ?
                        Option.some(Effect.unit()) :
                        Option.none
                    )
                  )
                ),
                Effect.zipRight(Queue.offer(outerQueue, take.end))
              )
            )
          )
      )
    return make(stream.unwrapScoped(
      pipe(
        Effect.sync(() => new Map<K, Queue.Queue<Take.Take<E, A>>>()),
        Effect.flatMap((map) =>
          pipe(
            Effect.acquireRelease(
              Queue.unbounded<Take.Take<E, readonly [K, Queue.Queue<Take.Take<E, A>>]>>(),
              (queue) => Queue.shutdown(queue)
            ),
            Effect.flatMap((queue) =>
              pipe(
                self.channel,
                core.pipeTo(loop(map, queue)),
                channel.drain,
                channelExecutor.runScoped,
                Effect.forkScoped,
                Effect.as(stream.flattenTake(stream.fromQueueWithShutdown(queue)))
              )
            )
          )
        )
      )
    ))
  }
}

/** @internal */
export const mapEffectParByKey = <A, K>(keyBy: (a: A) => K, bufferSize = 16) => {
  return <R2, E2, A2>(f: (a: A) => Effect.Effect<R2, E2, A2>) => {
    return <R, E>(self: Stream.Stream<R, E, A>): Stream.Stream<R | R2, E | E2, A2> =>
      pipe(
        self,
        groupByKey(keyBy, bufferSize),
        evaluate((_, s) => pipe(s, stream.mapEffect(f)))
      )
  }
}

/**
 * A variant of `groupBy` that retains the insertion order of keys.
 *
 * @internal
 */
export const groupByIterable = <V, K>(f: (value: V) => K) => {
  return (iterable: Iterable<V>): Chunk.Chunk<readonly [K, Chunk.Chunk<V>]> => {
    const builder: Array<readonly [K, Array<V>]> = []
    const iterator = iterable[Symbol.iterator]()
    const map = new Map<K, Array<V>>()
    let next: IteratorResult<V, any>
    while ((next = iterator.next()) && !next.done) {
      const value = next.value
      const key = f(value)
      if (map.has(key)) {
        const innerBuilder = map.get(key)!
        innerBuilder.push(value)
      } else {
        const innerBuilder: Array<V> = [value]
        builder.push([key, innerBuilder] as const)
        map.set(key, innerBuilder)
      }
    }
    return Chunk.unsafeFromArray(
      builder.map((tuple) => [tuple[0], Chunk.unsafeFromArray(tuple[1])] as const)
    )
  }
}
