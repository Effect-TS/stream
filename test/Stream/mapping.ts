import * as Chunk from "@effect/data/Chunk"
import * as Duration from "@effect/data/Duration"
import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Cause from "@effect/io/Cause"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal_effect_untraced/testing/testClock"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("map", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => n * 2
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.map(f), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.map(f)))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapAccum", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 1, 1),
        Stream.mapAccum(0, (acc, curr) => [acc + curr, acc + curr]),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("mapAccumEffect - happy path", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 1, 1),
        Stream.mapAccumEffect(0, (acc, curr) => Effect.succeed([acc + curr, acc + curr])),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("mapAccumEffect - error", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 1, 1),
        Stream.mapAccumEffect(0, () => Effect.fail("Ouch")),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("mapAccumEffect - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.mapAccumEffect(void 0, (_, n) =>
          n === 3 ?
            Effect.fail("boom") :
            Effect.succeed([void 0, n] as const)),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.right(1), Either.right(2), Either.left("boom")]
      )
    }))

  it.effect("mapConcat", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => Chunk.of(n)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapConcat(f), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.flatMap((n) => f(n))))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapConcatChunk", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => Chunk.of(n)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapConcatChunk(f), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.flatMap((n) => f(n))))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapConcatChunkEffect - happy path", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => Chunk.of(n)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapConcatChunkEffect((n) => Effect.succeed(f(n))), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.flatMap((n) => f(n))))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapConcatChunkEffect - error", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.mapConcatChunkEffect(() => Effect.fail("Ouch")),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("mapConcatEffect - happy path", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => Chunk.of(n)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapConcatEffect((n) => Effect.succeed(f(n))), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.flatMap((n) => f(n))))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapConcatEffect - error", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.mapConcatEffect(() => Effect.fail("Ouch")),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("mapError", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fail("123"),
        Stream.mapError((n) => Number.parseInt(n)),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left(123))
    }))

  it.effect("mapErrorCause", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.failCause(Cause.fail("123")),
        Stream.mapErrorCause(Cause.map((s) => Number.parseInt(s))),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left(123))
    }))

  it.effect("mapEffect - Effect.forEach equivalence", () =>
    Effect.gen(function*($) {
      const chunk = Chunk.make(1, 2, 3, 4, 5)
      const stream = Stream.fromIterable(chunk)
      const f = (n: number) => Effect.succeed(n * 2)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapEffect(f), Stream.runCollect),
        result2: pipe(chunk, Effect.forEach(f))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapEffect - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.mapEffect((n) =>
          n === 3 ?
            Effect.fail("boom") :
            Effect.succeed(n)
        ),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.right(1), Either.right(2), Either.left("boom")]
      )
    }))

  it.effect("mapEffectPar - Effect.forEachParN equivalence", () =>
    Effect.gen(function*($) {
      const parallelism = 8
      const chunk = Chunk.make(1, 2, 3, 4, 5)
      const stream = Stream.fromIterable(chunk)
      const f = (n: number) => Effect.succeed(n * 2)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapEffectPar(parallelism, f), Stream.runCollect),
        result2: pipe(chunk, Effect.forEachPar(f), Effect.withParallelism(parallelism))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapEffectPar - ordering when parallelism is 1", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.unbounded<number>())
      yield* $(pipe(
        Stream.range(0, 9),
        Stream.mapEffectPar(1, (n) => pipe(Queue.offer(queue, n))),
        Stream.runDrain
      ))
      const result = yield* $(Queue.takeAll(queue))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3, 4, 5, 6, 7, 8])
    }))

  it.effect("mapEffectPar - interruption propagation", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const fiber = yield* $(pipe(
        Stream.make(void 0),
        Stream.mapEffectPar(1, () =>
          pipe(
            Deferred.succeed<never, void>(latch, void 0),
            Effect.zipRight(Effect.never()),
            Effect.onInterrupt(() => Ref.set(ref, true))
          )),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(Deferred.await(latch))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(Ref.get(ref))
      assert.isTrue(result)
    }))

  it.effect("mapEffectPar - guarantees ordering", () =>
    Effect.gen(function*($) {
      const n = 4096
      const chunk = Chunk.make(1, 2, 3, 4, 5)
      const stream = Stream.fromChunk(chunk)
      const { result1, result2 } = yield* $(Effect.all({
        result1: pipe(stream, Stream.mapEffect(Effect.succeed), Stream.runCollect),
        result2: pipe(stream, Stream.mapEffectPar(n, Effect.succeed), Stream.runCollect)
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("mapEffectPar - awaits child fibers properly", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromIterable(Chunk.range(0, 10)),
        Stream.interruptWhen(Effect.never()),
        Stream.mapEffectPar(8, () => pipe(Effect.succeed(1), Effect.repeatN(200))),
        Stream.runDrain,
        Effect.exit
      ))
      assert.isFalse(Exit.isInterrupted(result))
    }))

  it.effect("mapEffectPar - interrupts pending tasks when one of the tasks fails", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const latch1 = yield* $(Deferred.make<never, void>())
      const latch2 = yield* $(Deferred.make<never, void>())
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.mapEffectPar(
          3,
          (n) =>
            n === 1 ?
              pipe(
                Deferred.succeed<never, void>(latch1, void 0),
                Effect.zipRight(Effect.never()),
                Effect.onInterrupt(() => Ref.update(ref, (n) => n + 1))
              ) :
              n === 2 ?
              pipe(
                Deferred.succeed<never, void>(latch2, void 0),
                Effect.zipRight(Effect.never()),
                Effect.onInterrupt(() => Ref.update(ref, (n) => n + 1))
              ) :
              pipe(
                Deferred.await(latch1),
                Effect.zipRight(Deferred.await(latch1)),
                Effect.zipRight(Effect.fail("boom"))
              )
        ),
        Stream.runDrain,
        Effect.exit
      ))
      const count = yield* $(Ref.get(ref))
      assert.strictEqual(count, 2)
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("mapEffectPar - propagates the correct error with subsequent calls to mapEffectPar (ZIO #4514)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromIterable(Chunk.range(1, 50)),
        Stream.mapEffectPar(20, (n) => n < 10 ? Effect.succeed(n) : Effect.fail("boom")),
        Stream.mapEffectPar(20, (n) => Effect.succeed(n)),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("boom"))
    }))

  it.effect("mapEffectPar - propagates the error of the original stream", () =>
    Effect.gen(function*($) {
      const fiber = yield* $(pipe(
        Stream.range(1, 11),
        Stream.concat(Stream.fail(Cause.RuntimeException("boom"))),
        Stream.mapEffectPar(2, () => Effect.sleep(Duration.seconds(1))),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(5)))
      const exit = yield* $(Fiber.await(fiber))
      assert.deepStrictEqual(Exit.unannotate(exit), Exit.fail(Cause.RuntimeException("boom")))
    }))

  it.effect("mapEffectParUnordered - mapping with failure is failure", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromIterable(Chunk.range(0, 3)),
        Stream.mapEffectParUnordered(10, () => Effect.fail("fail")),
        Stream.runDrain,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("fail"))
    }))
})
