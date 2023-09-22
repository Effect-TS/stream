import * as Chunk from "@effect/data/Chunk"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("changes", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(0, 19)
      const result = yield* $(
        stream,
        Stream.changes,
        Stream.runCollect
      )
      const expected = yield* $(
        stream,
        Stream.runCollect,
        Effect.map(Chunk.reduce(Chunk.empty<number>(), (acc, n) =>
          acc.length === 0 || Chunk.unsafeGet(acc, 0) !== n ? Chunk.append(acc, n) : acc))
      )
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))

  it.effect("changesWithEffect", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(0, 19)
      const result = yield* $(
        stream,
        Stream.changesWithEffect((left, right) => Effect.succeed(left === right)),
        Stream.runCollect
      )
      const expected = yield* $(
        stream,
        Stream.runCollect,
        Effect.map(Chunk.reduce(Chunk.empty<number>(), (acc, n) =>
          acc.length === 0 || Chunk.unsafeGet(acc, 0) !== n ? Chunk.append(acc, n) : acc))
      )
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))
})
