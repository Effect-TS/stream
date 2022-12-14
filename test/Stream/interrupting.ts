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
  it.effect("interruptWhen - preserves the scope of inner fibers", () =>
    Effect.gen(function*($) {
      const deferred = yield* $(Deferred.make<never, void>())
      const queue1 = yield* $(Queue.unbounded<Chunk.Chunk<number>>())
      const queue2 = yield* $(Queue.unbounded<Chunk.Chunk<number>>())
      yield* $(pipe(queue1, Queue.offer(Chunk.of(1))))
      yield* $(pipe(queue2, Queue.offer(Chunk.of(2))))
      yield* $(pipe(queue1, Queue.offer(Chunk.of(3)), Effect.fork))
      yield* $(pipe(queue2, Queue.offer(Chunk.of(4)), Effect.fork))
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

  it.effect("interruptAfter - halts after the given duration", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.of(1),
        Chunk.of(2),
        Chunk.of(3),
        Chunk.of(4)
      ]))
      const fiber = yield* $(pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.interruptAfter(Duration.seconds(5)),
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
      yield* $(coordination.offer)
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1], [2]]
      )
    }))

  it.effect("interruptAfter - will process first chunk", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.unbounded<number>())
      const fiber = yield* $(pipe(
        Stream.fromQueue(queue),
        Stream.interruptAfter(Duration.seconds(5)),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(6)))
      yield* $(pipe(queue, Queue.offer(1)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [])
    }))
})
