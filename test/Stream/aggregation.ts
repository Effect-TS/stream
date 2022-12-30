import * as Cause from "@effect/io/Cause"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Schedule from "@effect/io/Schedule"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as Take from "@effect/stream/Take"
import { chunkCoordination } from "@effect/stream/test/utils/coordination"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Duration from "@fp-ts/data/Duration"
import * as Either from "@fp-ts/data/Either"
import { constTrue, constVoid, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

Stream.onError

describe.concurrent("Stream", () => {
  it.effect("aggregate - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.make(1, 1, 1, 1),
          Stream.aggregate(
            Sink.foldUntil(Chunk.empty<number>(), 3, (acc, curr) => acc.prepend(curr))
          ),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(Chunk.flatten(result)), [1, 1, 1, 1])
      assert.isTrue(Array.from(result).every((chunk) => chunk.length <= 3))
    }))

  it.effect("aggregate - error propagation #1", () =>
    Effect.gen(function*($) {
      const error = Cause.RuntimeException("Boom")
      const result = yield* $(
        pipe(
          Stream.make(1, 1, 1, 1),
          Stream.aggregate(Sink.die(error)),
          Stream.runCollect,
          Effect.exit
        )
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.die(error))
    }))

  it.effect("aggregate - error propagation #2", () =>
    Effect.gen(function*($) {
      const error = Cause.RuntimeException("Boom")
      const result = yield* $(
        pipe(
          Stream.make(1, 1),
          Stream.aggregate(
            Sink.foldLeftEffect(Chunk.empty(), () => Effect.die(error))
          ),
          Stream.runCollect,
          Effect.exit
        )
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.die(error))
    }))

  it.effect("aggregate - interruption propagation #1", () =>
    Effect.gen(function*($) {
      const latch = yield* $(Deferred.make<never, void>())
      const ref = yield* $(Ref.make(false))
      const sink = Sink.foldEffect(Chunk.empty<number>(), constTrue, (acc, curr) => {
        if (curr === 1) {
          return Effect.succeed(acc.prepend(curr))
        }
        return pipe(
          latch,
          Deferred.succeed<void>(void 0),
          Effect.zipRight(Effect.never()),
          Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
        )
      })
      const fiber = yield* $(pipe(
        Stream.make(1, 1, 2),
        Stream.aggregate(sink),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(Deferred.await(latch))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("aggregate - interruption propagation #2", () =>
    Effect.gen(function*($) {
      const latch = yield* $(Deferred.make<never, void>())
      const ref = yield* $(Ref.make(false))
      const sink = Sink.fromEffect(pipe(
        latch,
        Deferred.succeed<void>(void 0),
        Effect.zipRight(Effect.never()),
        Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
      ))
      const fiber = yield* $(pipe(
        Stream.make(1, 1, 2),
        Stream.aggregate(sink),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(Deferred.await(latch))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("aggregate - leftover handling", () =>
    Effect.gen(function*($) {
      const input = [1, 2, 2, 3, 2, 3]
      const result = yield* $(
        pipe(
          Stream.fromIterable(input),
          Stream.aggregate(Sink.foldWeighted(
            Chunk.empty<number>(),
            4,
            (_, n) => n,
            (acc, curr) => acc.append(curr)
          )),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(Chunk.flatten(result)), input)
    }))

  it.effect("aggregate - ZIO issue 6395", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.aggregate(Sink.collectAllN(2)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3]]
      )
    }))

  // TODO(Mike/Max): after @effect/test
  //   test("zio-kafka issue") {
  //     assertZIO(
  //       for {
  //         queue <- Queue.unbounded[Take[Nothing, Int]]
  //         fiber <- ZStream
  //                    .fromQueue(queue)
  //                    .flattenTake
  //                    .aggregateAsync(
  //                      ZSink
  //                        .foldLeft[Int, List[Int]](Nil) { case (l, n) => n :: l }
  //                    )
  //                    .runCollect
  //                    .fork

  //         _ <- ZIO.sleep(1.second)
  //         _ <- queue.offer(Take.chunk(Chunk(1, 2, 3, 4, 5)))
  //         _ <- ZIO.sleep(1.second)
  //         _ <- queue.offer(Take.chunk(Chunk(6, 7, 8, 9, 10)))
  //         _ <- ZIO.sleep(1.second)
  //         _ <- queue.offer(Take.chunk(Chunk(11, 12, 13, 14, 15)))
  //         _ <- queue.offer(Take.end)

  //         result <- fiber.join
  //       } yield result.filter(_.nonEmpty)
  //     )(equalTo(Chunk(List(5, 4, 3, 2, 1), List(10, 9, 8, 7, 6), List(15, 14, 13, 12, 11))))
  //   } @@ withLiveClock
  // ),

  it.effect("aggregateWithin - child fiber handling", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.singleton(1),
        Chunk.singleton(2),
        Chunk.singleton(3)
      ]))
      const fiber = yield* $(
        pipe(
          Stream.fromQueue(coordination.queue),
          Stream.map(Take.make),
          Stream.tap(() => coordination.proceed),
          Stream.flattenTake,
          Stream.aggregateWithin(
            Sink.last<number>(),
            Schedule.fixed(Duration.millis(20))
          ),
          Stream.interruptWhen(Effect.never()),
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        )
      )
      yield* $(
        pipe(
          coordination.offer,
          // TODO(Mike/Max): swap out for TestClock
          Effect.zipRight(Effect.sleep(Duration.millis(10))),
          Effect.zipRight(coordination.awaitNext),
          Effect.repeatN(3)
        )
      )
      const results = yield* $(pipe(Fiber.join(fiber), Effect.map(Chunk.compact)))
      assert.deepStrictEqual(Array.from(results), [2, 3])
    }))

  it.effect("aggregateWithinEither - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 1, 1, 1, 2, 2),
        Stream.aggregateWithinEither(
          pipe(
            Sink.fold(
              [[] as Array<number>, true] as readonly [Array<number>, boolean],
              (tuple) => tuple[1],
              ([array], curr: number): readonly [Array<number>, boolean] => {
                if (curr === 1) {
                  return [[curr, ...array], true]
                }
                return [[curr, ...array], false]
              }
            ),
            Sink.map((tuple) => tuple[0])
          ),
          Schedule.spaced(Duration.minutes(30))
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.right([2, 1, 1, 1, 1]), Either.right([2])]
      )
    }))

  it.effect("aggregateWithinEither - fails fast", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.unbounded<number>())
      yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.tap((n) =>
            pipe(
              Effect.fail("Boom"),
              Effect.when(() => n === 6),
              Effect.zipRight(pipe(queue, Queue.offer(n)))
            )
          ),
          Stream.aggregateWithinEither(
            Sink.foldUntil(void 0, 5, constVoid),
            Schedule.forever()
          ),
          Stream.runDrain,
          Effect.catchAll(() => Effect.succeed(void 0))
        )
      )
      const result = yield* $(Queue.takeAll(queue))
      yield* $(Queue.shutdown(queue))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4, 5])
    }))

  it.effect("aggregateWithinEither - error propagation #1", () =>
    Effect.gen(function*($) {
      const error = Cause.RuntimeException("Boom")
      const result = yield* $(
        pipe(
          Stream.make(1, 1, 1, 1),
          Stream.aggregateWithinEither(
            Sink.die(error),
            Schedule.spaced(Duration.minutes(30))
          ),
          Stream.runCollect,
          Effect.exit
        )
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.die(error))
    }))

  it.effect("aggregateWithinEither - error propagation #2", () =>
    Effect.gen(function*($) {
      const error = Cause.RuntimeException("Boom")
      const result = yield* $(
        pipe(
          Stream.make(1, 1),
          Stream.aggregateWithinEither(
            Sink.foldEffect(Chunk.empty<number>(), constTrue, () => Effect.die(error)),
            Schedule.spaced(Duration.minutes(30))
          ),
          Stream.runCollect,
          Effect.exit
        )
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.die(error))
    }))

  it.effect("aggregateWithinEither - interruption propagation #1", () =>
    Effect.gen(function*($) {
      const latch = yield* $(Deferred.make<never, void>())
      const ref = yield* $(Ref.make(false))
      const sink = Sink.foldEffect(Chunk.empty<number>(), constTrue, (acc, curr) => {
        if (curr === 1) {
          return Effect.succeed(acc.prepend(curr))
        }
        return pipe(
          latch,
          Deferred.succeed<void>(void 0),
          Effect.zipRight(Effect.never()),
          Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
        )
      })
      const fiber = yield* $(
        pipe(
          Stream.make(1, 1, 2),
          Stream.aggregateWithinEither(sink, Schedule.spaced(Duration.minutes(30))),
          Stream.runCollect,
          Effect.fork
        )
      )
      yield* $(Deferred.await(latch))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("aggregateWithinEither - interruption propagation #2", () =>
    Effect.gen(function*($) {
      const latch = yield* $(Deferred.make<never, void>())
      const ref = yield* $(Ref.make(false))
      const sink = Sink.fromEffect(pipe(
        latch,
        Deferred.succeed<void>(void 0),
        Effect.zipRight(Effect.never()),
        Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
      ))
      const fiber = yield* $(
        pipe(
          Stream.make(1, 1, 2),
          Stream.aggregateWithinEither(sink, Schedule.spaced(Duration.minutes(30))),
          Stream.runCollect,
          Effect.fork
        )
      )
      yield* $(Deferred.await(latch))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("aggregateWithinEither - leftover handling", () =>
    Effect.gen(function*($) {
      const input = [1, 2, 2, 3, 2, 3]
      const fiber = yield* $(
        pipe(
          Stream.fromIterable(input),
          Stream.aggregateWithinEither(
            Sink.foldWeighted(
              Chunk.empty<number>(),
              4,
              (_, n) => n,
              (acc, curr) => acc.append(curr)
            ),
            Schedule.spaced(Duration.millis(10))
          ),
          Stream.collect((either) =>
            Either.isRight(either) ?
              Option.some(either.right) :
              Option.none
          ),
          Stream.runCollect,
          Effect.map(Chunk.flatten),
          Effect.fork
        )
      )
      // TODO(Mike/Max): swap out with TestClock
      yield* $(Effect.sleep(Duration.millis(100)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), input)
    }))
})
