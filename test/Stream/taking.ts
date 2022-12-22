import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import { constFalse, pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("take", () =>
    Effect.gen(function*($) {
      const take = 3
      const stream = Stream.range(1, 6)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.take(take), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.take(take)))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("take - short circuits", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const stream = pipe(
        Stream.make(1),
        Stream.concat(Stream.drain(Stream.fromEffect(pipe(ref, Ref.set(true))))),
        Stream.take(0)
      )
      yield* $(Stream.runDrain(stream))
      const result = yield* $(Ref.get(ref))
      assert.isFalse(result)
    }))

  it.effect("take - taking 0 short circuits", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(Stream.never(), Stream.take(0), Stream.runCollect))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("take - taking 1 short circuits", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.concat(Stream.never()),
        Stream.take(1),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1])
    }))

  it.effect("takeRight", () =>
    Effect.gen(function*($) {
      const take = 3
      const stream = Stream.range(1, 6)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.takeRight(take), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.takeRight(take)))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("takeUntil", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(1, 6)
      const f = (n: number) => n % 3 === 0
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.takeUntil(f), Stream.runCollect),
        result2: pipe(
          Stream.runCollect(stream),
          Effect.map((chunk) =>
            pipe(
              chunk,
              Chunk.takeWhile((a) => !f(a)),
              Chunk.concat(pipe(chunk, Chunk.dropWhile((a) => !f(a)), Chunk.take(1)))
            )
          )
        )
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("takeUntilEffect", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(1, 6)
      const f = (n: number) => Effect.succeed(n % 3 === 0)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.takeUntilEffect(f), Stream.runCollect),
        result2: pipe(
          Stream.runCollect(stream),
          Effect.flatMap((chunk) =>
            pipe(
              chunk,
              Effect.takeWhile((a) => Effect.negate(f(a))),
              Effect.zipWith(
                pipe(chunk, Effect.dropWhile((a) => Effect.negate(f(a))), Effect.map(Chunk.take(1))),
                (chunk1, chunk2) => pipe(chunk1, Chunk.concat(chunk2))
              )
            )
          )
        )
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("takeUntilEffect - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.takeUntilEffect((n) =>
          n === 2 ?
            Effect.fail("boom") :
            Effect.succeed(false)
        ),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [Either.right(1), Either.left("boom")])
    }))

  it.effect("takeWhile", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(1, 6)
      const f = (n: number) => n <= 3
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.takeWhile(f), Stream.runCollect),
        result2: pipe(Stream.runCollect(stream), Effect.map(Chunk.takeWhile(f)))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("takeWhile - does not stop when hitting an empty chunk (ZIO #4272)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromChunks(Chunk.singleton(1), Chunk.singleton(2), Chunk.singleton(3)),
        Stream.mapChunks(Chunk.flatMap((n) =>
          n === 2 ?
            Chunk.empty<number>() :
            Chunk.singleton(n)
        )),
        Stream.takeWhile((n) => n !== 4),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 3])
    }))

  it.effect("takeWhile - short circuits", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.concat(Stream.fail("Ouch")),
        Stream.takeWhile(constFalse),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))
})