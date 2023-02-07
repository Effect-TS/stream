import * as Chunk from "@effect/data/Chunk"
import * as Duration from "@effect/data/Duration"
import * as Clock from "@effect/io/Clock"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal_effect_untraced/testing/testClock"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Schedule from "@effect/io/Schedule"
import * as Stream from "@effect/stream/Stream"
import { chunkCoordination } from "@effect/stream/test/utils/coordination"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("throttleEnforce - free elements", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.throttleEnforce(() => 0, 0, Duration.infinity),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4])
    }))

  it.effect("throttleEnforce - no bandwidth", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.throttleEnforce(() => 1, 0, Duration.infinity),
        Stream.runCollect
      ))
      assert.isTrue(Chunk.isEmpty(result))
    }))

  it.effect("throttleShape", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.bounded<number>(10))
      const fiber = yield* $(pipe(
        Stream.fromQueue(queue),
        Stream.throttleShape(Chunk.reduce(0, (x, y) => x + y), 1, Duration.seconds(1)),
        Stream.toPull,
        Effect.flatMap((pull) =>
          Effect.gen(function*($) {
            yield* $(pipe(Queue.offer(queue, 1)))
            const result1 = yield* $(pull)
            yield* $(pipe(Queue.offer(queue, 2)))
            const result2 = yield* $(pull)
            yield* $(Effect.sleep(Duration.seconds(4)))
            yield* $(pipe(Queue.offer(queue, 3)))
            const result3 = yield* $(pull)
            return [Array.from(result1), Array.from(result2), Array.from(result3)] as const
          })
        ),
        Effect.scoped,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(8)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(result, [[1], [2], [3]])
    }))

  it.effect("throttleShape - infinite bandwidth", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.bounded<number>(10))
      const result = yield* $(pipe(
        Stream.fromQueue(queue),
        Stream.throttleShape(() => 100_000, 1, Duration.zero),
        Stream.toPull,
        Effect.flatMap((pull) =>
          Effect.gen(function*($) {
            yield* $(pipe(Queue.offer(queue, 1)))
            const result1 = yield* $(pull)
            yield* $(pipe(Queue.offer(queue, 2)))
            const result2 = yield* $(pull)
            const elapsed = yield* $(Clock.currentTimeMillis())
            return [Array.from(result1), Array.from(result2), elapsed] as const
          })
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(result, [[1], [2], 0])
    }))

  it.effect("throttleShape - with burst", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.bounded<number>(10))
      const fiber = yield* $(pipe(
        Stream.fromQueue(queue),
        Stream.throttleShapeBurst(Chunk.reduce(0, (x, y) => x + y), 1, Duration.seconds(1), 2),
        Stream.toPull,
        Effect.flatMap((pull) =>
          Effect.gen(function*($) {
            yield* $(pipe(Queue.offer(queue, 1)))
            const result1 = yield* $(pull)
            yield* $(TestClock.adjust(Duration.seconds(2)))
            yield* $(pipe(Queue.offer(queue, 2)))
            const result2 = yield* $(pull)
            yield* $(TestClock.adjust(Duration.seconds(4)))
            yield* $(pipe(Queue.offer(queue, 3)))
            const result3 = yield* $(pull)
            return [Array.from(result1), Array.from(result2), Array.from(result3)] as const
          })
        ),
        Effect.scoped,
        Effect.fork
      ))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(result, [[1], [2], [3]])
    }))

  it.effect("throttleShape - free elements", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.throttleShape(() => 0, 1, Duration.infinity),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4])
    }))

  it.effect("debounce - should drop earlier chunks within waitTime", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.of(1),
        Chunk.make(3, 4),
        Chunk.of(5),
        Chunk.make(6, 7)
      ]))
      const stream = pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.debounce(Duration.seconds(1)),
        Stream.tap(() => coordination.proceed)
      )
      const fiber = yield* $(pipe(stream, Stream.runCollect, Effect.fork))
      yield* $(Effect.fork(coordination.offer))
      yield* $(pipe(
        Effect.sleep(Duration.millis(500)),
        Effect.zipRight(coordination.offer),
        Effect.fork
      ))
      yield* $(pipe(
        Effect.sleep(Duration.seconds(2)),
        Effect.zipRight(coordination.offer),
        Effect.fork
      ))
      yield* $(pipe(
        Effect.sleep(Duration.millis(2500)),
        Effect.zipRight(coordination.offer),
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.millis(3500)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[3, 4], [6, 7]]
      )
    }))

  it.effect("debounce - should take latest chunk within waitTime", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.make(1, 2),
        Chunk.make(3, 4),
        Chunk.make(5, 6)
      ]))
      const stream = pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.debounce(Duration.seconds(1)),
        Stream.tap(() => coordination.proceed)
      )
      const fiber = yield* $(pipe(stream, Stream.runCollect, Effect.fork))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(coordination.offer),
        Effect.zipRight(coordination.offer)
      ))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[5, 6]]
      )
    }))

  it.effect("debounce - should work properly with parallelization", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.of(1),
        Chunk.of(2),
        Chunk.of(3)
      ]))
      const stream = pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.debounce(Duration.seconds(1)),
        Stream.tap(() => coordination.proceed)
      )
      const fiber = yield* $(pipe(stream, Stream.runCollect, Effect.fork))
      yield* $(Effect.collectAllParDiscard([
        coordination.offer,
        coordination.offer,
        coordination.offer
      ]))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[3]]
      )
    }))

  it.effect("debounce - should handle empty chunks properly", () =>
    Effect.gen(function*($) {
      const fiber = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.schedule<never, number>(Schedule.fixed(Duration.millis(500))),
        Stream.debounce(Duration.seconds(1)),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(3)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [3])
    }))

  it.effect("debounce - should fail immediately", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromEffect(Effect.fail(Option.none())),
        Stream.debounce(Duration.infinity),
        Stream.runCollect,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail(Option.none()))
    }))

  it.effect("debounce - should work with empty streams", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.empty,
        Stream.debounce(Duration.seconds(5)),
        Stream.runCollect
      ))
      assert.isTrue(Chunk.isEmpty(result))
    }))

  it.effect("debounce - should pick last element from every chunk", () =>
    Effect.gen(function*($) {
      const fiber = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.debounce(Duration.seconds(1)),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [3])
    }))

  it.effect("debounce - should interrupt fibers properly", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([
        Chunk.of(1),
        Chunk.of(2),
        Chunk.of(3)
      ]))
      const fiber = yield* $(pipe(
        Stream.fromQueue(coordination.queue),
        Stream.tap(() => coordination.proceed),
        Stream.flatMap((exit) => Stream.fromEffectOption(Effect.done(exit))),
        Stream.flattenChunks,
        Stream.debounce(Duration.millis(200)),
        Stream.interruptWhen(Effect.never()),
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(pipe(
        coordination.offer,
        Effect.zipRight(TestClock.adjust(Duration.millis(100))),
        Effect.zipRight(coordination.awaitNext),
        Effect.repeatN(3)
      ))
      yield* $(TestClock.adjust(Duration.millis(100)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [3])
    }))

  it.effect("debounce - should interrupt children fiber on stream interruption", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const fiber = yield* $(pipe(
        Stream.fromEffect(Effect.unit()),
        Stream.concat(Stream.fromEffect(pipe(
          Effect.never(),
          Effect.onInterrupt(() => Ref.set(ref, true))
        ))),
        Stream.debounce(Duration.millis(800)),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.minutes(1)))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))
})
