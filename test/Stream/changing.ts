import * as Chunk from "@effect/data/Chunk"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("changes", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(0, 20)
      const result = yield* $(pipe(
        stream,
        Stream.changes,
        Stream.runCollect
      ))
      const expected = yield* $(pipe(
        stream,
        Stream.runCollect,
        Effect.map(Chunk.reduce(Chunk.empty<number>(), (acc, n) =>
          acc.length === 0 || acc.unsafeGet(0) !== n ? acc.append(n) : acc))
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))

  it.effect("changesWithEffect", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(0, 20)
      const result = yield* $(pipe(
        stream,
        Stream.changesWithEffect((left, right) => Effect.succeed(left === right)),
        Stream.runCollect
      ))
      const expected = yield* $(pipe(
        stream,
        Stream.runCollect,
        Effect.map(Chunk.reduce(Chunk.empty<number>(), (acc, n) =>
          acc.length === 0 || acc.unsafeGet(0) !== n ? acc.append(n) : acc))
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))
})
