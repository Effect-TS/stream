import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("interruptWhen - preserves the scope of inner fibers", () =>
    Effect.gen(function*($) {
      const deferred = yield* $(Deferred.make<never, void>())
      const queue1 = yield* $(Queue.unbounded<Chunk.Chunk<number>>())
      const queue2 = yield* $(Queue.unbounded<Chunk.Chunk<number>>())
      yield* $(pipe(queue1, Queue.offer(Chunk.singleton(1))))
      yield* $(pipe(queue2, Queue.offer(Chunk.singleton(2))))
      yield* $(pipe(queue1, Queue.offer(Chunk.singleton(3)), Effect.fork))
      yield* $(pipe(queue2, Queue.offer(Chunk.singleton(4)), Effect.fork))
      const stream1 = Stream.fromChunkQueue(queue1)
      const stream2 = Stream.fromChunkQueue(queue2)
      const stream = pipe(
        stream1,
        Stream.zipLatest(stream2),
        Stream.interruptWhen(Deferred.await(deferred)),
        Stream.take(3)
      )
      const result = yield* $(Stream.runDrain(stream))
      assert.isUndefined(result)
    }))

  it.effect("interruptWhen - interrupts the current element", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      const started = yield* $(Deferred.make<never, void>())
      const fiber = yield* $(pipe(
        Stream.fromEffect(pipe(
          started,
          Deferred.succeed<void>(void 0),
          Effect.zipRight(Deferred.await(latch)),
          Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
        )),
        Stream.interruptWhen(Deferred.await(halt)),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(pipe(
        Deferred.await(started),
        Effect.zipRight(pipe(halt, Deferred.succeed<void>(void 0)))
      ))
      yield* $(Fiber.await(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("interruptWhen - propagates errors", () =>
    Effect.gen(function*($) {
      const halt = yield* $(Deferred.make<string, never>())
      yield* $(pipe(halt, Deferred.fail("fail")))
      const result = yield* $(pipe(
        Stream.never(),
        Stream.interruptWhen(Deferred.await(halt)),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))

  it.effect("interruptWhenDeferred - interrupts the current element", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      const started = yield* $(Deferred.make<never, void>())
      const fiber = yield* $(pipe(
        Stream.fromEffect(pipe(
          started,
          Deferred.succeed<void>(void 0),
          Effect.zipRight(Deferred.await(latch)),
          Effect.onInterrupt(() => pipe(ref, Ref.set(true)))
        )),
        Stream.interruptWhenDeferred(halt),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(pipe(
        Deferred.await(started),
        Effect.zipRight(pipe(halt, Deferred.succeed<void>(void 0)))
      ))
      yield* $(Fiber.await(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("interruptWhenDeferred - propagates errors", () =>
    Effect.gen(function*($) {
      const halt = yield* $(Deferred.make<string, never>())
      yield* $(pipe(halt, Deferred.fail("fail")))
      const result = yield* $(pipe(
        Stream.never(),
        Stream.interruptWhenDeferred(halt),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))

  // TODO(Mike/Max): after `@effect/test`
  // suite("interruptAfter")(
  //   test("interrupts after given duration") {
  //     assertWithChunkCoordination(List(Chunk(1), Chunk(2), Chunk(3))) { c =>
  //       assertZIO(
  //         for {
  //           fiber <- ZStream
  //                      .fromQueue(c.queue)
  //                      .collectWhileSuccess
  //                      .interruptAfter(5.seconds)
  //                      .tap(_ => c.proceed)
  //                      .runCollect
  //                      .fork
  //           _      <- c.offer *> TestClock.adjust(3.seconds) *> c.awaitNext
  //           _      <- c.offer *> TestClock.adjust(3.seconds) *> c.awaitNext
  //           _      <- c.offer
  //           result <- fiber.join
  //         } yield result
  //       )(equalTo(Chunk(Chunk(1), Chunk(2))))
  //     }
  //   },
  //   test("interrupts before first chunk") {
  //     for {
  //       queue  <- Queue.unbounded[Int]
  //       fiber  <- ZStream.fromQueue(queue).interruptAfter(5.seconds).runCollect.fork
  //       _      <- TestClock.adjust(6.seconds)
  //       _      <- queue.offer(1)
  //       result <- fiber.join
  //     } yield assert(result)(isEmpty)
  //   } @@ timeout(10.seconds) @@ flaky
  // ) @@ zioTag(interruption),
})
