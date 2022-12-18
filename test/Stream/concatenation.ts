import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("concat - simple example", () =>
    Effect.gen(function*($) {
      const stream1 = Stream.make(1, 2, 3)
      const stream2 = Stream.make(4, 5, 6)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(
          stream1,
          Stream.runCollect,
          Effect.zipWith(
            pipe(stream2, Stream.runCollect),
            (chunk1, chunk2) => pipe(chunk1, Chunk.concat(chunk2))
          )
        ),
        result2: pipe(
          stream1,
          Stream.concat(stream2),
          Stream.runCollect
        )
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("concat - finalizer ordering", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<string>()))
      yield* $(pipe(
        Stream.finalizer(pipe(ref, Ref.update(Chunk.append("Second")))),
        Stream.concat(Stream.finalizer(pipe(ref, Ref.update(Chunk.append("First"))))),
        Stream.runDrain
      ))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(Array.from(result), ["Second", "First"])
    }))
})
