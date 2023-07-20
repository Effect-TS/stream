import * as Chunk from "@effect/data/Chunk"
import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("partition - values", () =>
    Effect.gen(function*($) {
      const { result1, result2 } = yield* $(pipe(
        Stream.range(0, 6),
        Stream.partition((n) => n % 2 === 0),
        Effect.flatMap(([evens, odds]) =>
          Effect.all({
            result1: Stream.runCollect(evens),
            result2: Stream.runCollect(odds)
          })
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(Array.from(result1), [0, 2, 4])
      assert.deepStrictEqual(Array.from(result2), [1, 3, 5])
    }))

  it.effect("partition - errors", () =>
    Effect.gen(function*($) {
      const { result1, result2 } = yield* $(pipe(
        Stream.range(0, 1),
        Stream.concat(Stream.fail("boom")),
        Stream.partition((n) => n % 2 === 0),
        Effect.flatMap(([evens, odds]) =>
          Effect.all({
            result1: Effect.either(Stream.runCollect(evens)),
            result2: Effect.either(Stream.runCollect(odds))
          })
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(result1, Either.left("boom"))
      assert.deepStrictEqual(result2, Either.left("boom"))
    }))

  it.effect("partition - backpressure", () =>
    Effect.gen(function*($) {
      const { result1, result2, result3 } = yield* $(pipe(
        Stream.range(0, 6),
        Stream.partitionBuffer((n) => (n % 2 === 0), 1),
        Effect.flatMap(([evens, odds]) =>
          Effect.gen(function*($) {
            const ref = yield* $(Ref.make(Chunk.empty<number>()))
            const latch = yield* $(Deferred.make<never, void>())
            const fiber = yield* $(pipe(
              evens,
              Stream.tap((n) =>
                pipe(
                  Ref.update(ref, Chunk.prepend(n)),
                  Effect.zipRight(
                    pipe(
                      Deferred.succeed<never, void>(latch, void 0),
                      Effect.when(() => n === 2)
                    )
                  )
                )
              ),
              Stream.runDrain,
              Effect.fork
            ))
            yield* $(Deferred.await(latch))
            const result1 = yield* $(Ref.get(ref))
            const result2 = yield* $(Stream.runCollect(odds))
            yield* $(Fiber.await(fiber))
            const result3 = yield* $(Ref.get(ref))
            return { result1, result2, result3 }
          })
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(Array.from(result1), [2, 0])
      assert.deepStrictEqual(Array.from(result2), [1, 3, 5])
      assert.deepStrictEqual(Array.from(result3), [4, 2, 0])
    }))
})
