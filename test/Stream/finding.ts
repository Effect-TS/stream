import * as Chunk from "@effect/data/Chunk"
import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("find", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => n === 4
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.find(f), Stream.runCollect),
        result2: pipe(
          stream,
          Stream.runCollect,
          Effect.map(Chunk.findFirst(f)),
          Effect.map(Option.match(() => Chunk.empty<number>(), Chunk.of))
        )
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("findEffect - simple example", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(1, 2, 3, 4, 5)
      const f = (n: number) => Effect.succeed(n === 4)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.findEffect(f), Stream.runCollect),
        result2: pipe(
          stream,
          Stream.runCollect,
          Effect.flatMap((chunk) =>
            pipe(
              chunk,
              Effect.find(f),
              Effect.map(Option.match(() => Chunk.empty<number>(), Chunk.of))
            )
          )
        )
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("findEffect - throws correct error", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.findEffect((n) =>
          n === 3 ?
            Effect.fail("boom") :
            Effect.succeed(false)
        ),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.left("boom")]
      )
    }))
})
