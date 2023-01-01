import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal/testing/testClock"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import { chunkCoordination } from "@effect/stream/test/utils/coordination"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Duration from "@fp-ts/data/Duration"
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

  it.effect("haltAfter - halts after the given duration", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.singleton(1),
        Chunk.singleton(2),
        Chunk.singleton(3),
        Chunk.singleton(4)
      ]))
      const fiber = yield* $(pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.haltAfter(Duration.seconds(5)),
        Stream.tap(() => coordination.proceed),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(3))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(3))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.seconds(3))),
        Effect.zipRight(coordination.awaitNext)
      ))
      yield* $(coordination.offer)
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1], [2], [3]]
      )
    }))

  it.effect("haltAfter - will process first chunk", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.unbounded<number>())
      const fiber = yield* $(pipe(
        Stream.fromQueue(queue),
        Stream.haltAfter(Duration.seconds(5)),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(6)))
      yield* $(pipe(queue, Queue.offer(1)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [1])
    }))
})
