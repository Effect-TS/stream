import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("flatMap - empty input", () =>
    Effect.gen(function*($) {
      const sink = pipe(Sink.head<number>(), Sink.flatMap(Sink.succeed))
      const result = yield* $(pipe(Stream.empty, Stream.run(sink)))
      assert.deepStrictEqual(result, Option.none)
    }))

  it.effect("flatMap - non-empty input", () =>
    Effect.gen(function*($) {
      const sink = pipe(Sink.head<number>(), Sink.flatMap(Sink.succeed))
      const result = yield* $(pipe(Stream.make(1, 2, 3), Stream.run(sink)))
      assert.deepStrictEqual(result, Option.some(1))
    }))

  it.effect("flatMap - with leftovers", () =>
    Effect.gen(function*($) {
      const chunks = Chunk.make(
        Chunk.make(1, 2),
        Chunk.make(3, 4, 5),
        Chunk.empty<number>(),
        Chunk.make(7, 8, 9, 10)
      )
      const sink = pipe(
        Sink.head<number>(),
        Sink.flatMap((head) =>
          pipe(
            Sink.count(),
            Sink.map((count) => [head, count] as const)
          )
        )
      )
      const [option, count] = yield* $(pipe(Stream.fromChunks(...chunks), Stream.run(sink)))
      assert.deepStrictEqual(option, Chunk.head(Chunk.flatten(chunks)))
      assert.strictEqual(
        count + pipe(option, Option.match(() => 0, () => 1)),
        pipe(chunks, Chunk.map(Chunk.size), Chunk.reduce(0, (a, b) => a + b))
      )
    }))
})
