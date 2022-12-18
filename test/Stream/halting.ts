import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("haltWhen - halts after the current element", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      yield* $(pipe(
        Deferred.await(latch),
        Effect.onInterrupt(() => pipe(ref, Ref.set(true))),
        Stream.fromEffect,
        Stream.haltWhen(Deferred.await(halt)),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(pipe(halt, Deferred.succeed<void>(void 0)))
      yield* $(pipe(latch, Deferred.succeed<void>(void 0)))
      const result = yield* $(Ref.get(ref))
      assert.isFalse(result)
    }))

  it.effect("haltWhen - propagates errors", () =>
    Effect.gen(function*($) {
      const halt = yield* $(Deferred.make<string, void>())
      yield* $(pipe(halt, Deferred.fail("fail")))
      const result = yield* $(pipe(
        Stream.make(0),
        Stream.forever,
        Stream.haltWhen(Deferred.await(halt)),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))

  it.effect("haltWhenDeferred - halts after the current element", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      yield* $(pipe(
        Deferred.await(latch),
        Effect.onInterrupt(() => pipe(ref, Ref.set(true))),
        Stream.fromEffect,
        Stream.haltWhenDeferred(halt),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(pipe(halt, Deferred.succeed<void>(void 0)))
      yield* $(pipe(latch, Deferred.succeed<void>(void 0)))
      const result = yield* $(Ref.get(ref))
      assert.isFalse(result)
    }))

  it.effect("haltWhenDeferred - propagates errors", () =>
    Effect.gen(function*($) {
      const halt = yield* $(Deferred.make<string, void>())
      yield* $(pipe(halt, Deferred.fail("fail")))
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.haltWhenDeferred(halt),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))

  // TODO(Mike/Max): after `@effect/test`
  // it.effect("haltAfter - halts after the given duration", () =>
  //   Effect.gen(function*($) {

  //   })
  // )
  // suite("haltAfter")(
  //   test("halts after given duration") {
  //     assertWithChunkCoordination(List(Chunk(1), Chunk(2), Chunk(3), Chunk(4))) { c =>
  //       assertZIO(
  //         for {
  //           fiber <- ZStream
  //                      .fromQueue(c.queue)
  //                      .collectWhileSuccess
  //                      .haltAfter(5.seconds)
  //                      .tap(_ => c.proceed)
  //                      .runCollect
  //                      .fork
  //           _      <- c.offer *> TestClock.adjust(3.seconds) *> c.awaitNext
  //           _      <- c.offer *> TestClock.adjust(3.seconds) *> c.awaitNext
  //           _      <- c.offer *> TestClock.adjust(3.seconds) *> c.awaitNext
  //           _      <- c.offer
  //           result <- fiber.join
  //         } yield result
  //       )(equalTo(Chunk(Chunk(1), Chunk(2), Chunk(3))))
  //     }
  //   },
  //   test("will process first chunk") {
  //     for {
  //       queue  <- Queue.unbounded[Int]
  //       fiber  <- ZStream.fromQueue(queue).haltAfter(5.seconds).runCollect.fork
  //       _      <- TestClock.adjust(6.seconds)
  //       _      <- queue.offer(1)
  //       result <- fiber.join
  //     } yield assert(result)(equalTo(Chunk(1)))
  //   }
  // ),
})
