import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Duration from "@fp-ts/data/Duration"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("timeout - succeed", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.succeed(1),
        Stream.timeout(Duration.infinity),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1])
    }))

  it.effect("timeout - should end the stream", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(0, 5),
        Stream.tap(() => Effect.sleep(Duration.infinity)),
        Stream.timeout(Duration.zero),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("timeoutFail - succeed", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(0, 5),
        Stream.tap(() => Effect.sleep(Duration.infinity)),
        Stream.timeoutFail(() => false, Duration.zero),
        Stream.runDrain,
        Effect.map(() => true),
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left(false))
    }))

  it.effect("timeoutFail - failures", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fail("original"),
        Stream.timeoutFail(() => "timeout", Duration.minutes(15)),
        Stream.runDrain,
        Effect.flip
      ))
      assert.deepStrictEqual(result, "original")
    }))

  it.effect("timeoutFailCause", () =>
    Effect.gen(function*($) {
      const error = Cause.RuntimeException("boom")
      const result = yield* $(pipe(
        Stream.range(0, 5),
        Stream.tap(() => Effect.sleep(Duration.infinity)),
        Stream.timeoutFailCause(() => Cause.die(error), Duration.zero),
        Stream.runDrain,
        Effect.sandbox,
        Effect.either,
        Effect.map(Either.mapLeft(Cause.unannotate))
      ))
      assert.deepStrictEqual(result, Either.left(Cause.die(error)))
    }))

  it.effect("timeoutTo - succeed", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(0, 5),
        Stream.timeoutTo(Duration.infinity, Stream.succeed(-1)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3, 4])
    }))

  // TODO(Mike/Max): after `@effect/test`
  // it.effect("timeoutTo - should switch streams", () =>
  //   Effect.gen(function*($) {
  //     const coordination = yield* $(chunkCoordination([
  //       Chunk.singleton(1),
  //       Chunk.singleton(2),
  //       Chunk.singleton(3)
  //     ]))
  //     const fiber = yield* $(pipe(
  //       Stream.fromQueue(coordination.queue),
  //       Stream.collectWhileSuccess,
  //       Stream.flattenChunks,
  //       Stream.timeoutTo(Duration.seconds(2), Stream.succeed(4)),
  //       Stream.tap(() => coordination.proceed),
  //       Stream.runCollect,
  //       Effect.fork
  //     ))
  //     yield* $(pipe(
  //       coordination.offer,
  //       Effect.zipRight(TestClock.adjust(Duration.seconds(1))),
  //       Effect.zipRight(coordination.awaitNext)
  //     ))
  //     yield* $(pipe(
  //       coordination.offer,
  //       Effect.zipRight(TestClock.adjust(Duration.seconds(3))),
  //       Effect.zipRight(coordination.awaitNext)
  //     ))
  //     yield* $(coordination.offer)
  //     const result = yield* $(Fiber.join(fiber))
  //     assert.deepStrictEqual(Array.from(result), [1, 2, 4])
  //   }))

  // TODO(Mike/Max): after `@effect/test`
  //   test("should not apply timeout after switch") {
  //     for {
  //       queue1 <- Queue.unbounded[Int]
  //       queue2 <- Queue.unbounded[Int]
  //       stream1 = ZStream.fromQueue(queue1)
  //       stream2 = ZStream.fromQueue(queue2)
  //       fiber  <- stream1.timeoutTo(2.seconds)(stream2).runCollect.fork
  //       _      <- queue1.offer(1) *> TestClock.adjust(1.second)
  //       _      <- queue1.offer(2) *> TestClock.adjust(3.second)
  //       _      <- queue1.offer(3)
  //       _      <- queue2.offer(4) *> TestClock.adjust(3.second)
  //       _      <- queue2.offer(5) *> queue2.shutdown
  //       result <- fiber.join
  //     } yield assert(result)(equalTo(Chunk(1, 2, 4, 5)))
  //   }
  // ),
})
