import * as Chunk from "@effect/data/Chunk"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/core/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("split - should split properly", () =>
    Effect.gen(function*($) {
      const chunks = Chunk.make(
        Chunk.range(1, 2),
        Chunk.range(3, 4),
        Chunk.range(5, 6),
        Chunk.make(7, 8, 9),
        Chunk.of(10)
      )
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(
          Stream.range(0, 10),
          Stream.split((n) => n % 4 === 0),
          Stream.runCollect
        ),
        result2: pipe(
          Stream.fromChunks(...chunks),
          Stream.split((n) => n % 3 === 0),
          Stream.runCollect
        )
      }))
      assert.deepStrictEqual(
        Array.from(result1).map((chunk) => Array.from(chunk)),
        [[1, 2, 3], [5, 6, 7], [9]]
      )
      assert.deepStrictEqual(
        Array.from(result2).map((chunk) => Array.from(chunk)),
        [[1, 2], [4, 5], [7, 8], [10]]
      )
    }))

  it.effect("split - is equivalent to identity when the predicate is not satisfied", () =>
    Effect.gen(function*($) {
      const stream = Stream.range(1, 11)
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.split((n) => n % 11 === 0), Stream.runCollect),
        result2: pipe(
          Stream.runCollect(stream),
          Effect.map((chunk) => pipe(Chunk.of(chunk), Chunk.filter(Chunk.isNonEmpty)))
        )
      }))
      assert.deepStrictEqual(
        Array.from(result1).map((chunk) => Array.from(chunk)),
        [Array.from(Chunk.range(1, 10))]
      )
      assert.deepStrictEqual(
        Array.from(result1).map((chunk) => Array.from(chunk)),
        Array.from(result2).map((chunk) => Array.from(chunk))
      )
    }))

  it.effect("split - should output empty chunk when stream is empty", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.empty,
        Stream.split((n: number) => n % 11 === 0),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("splitOnChunk - consecutive delimiter yields empty Chunk", () =>
    Effect.gen(function*($) {
      const input = Stream.make(
        Chunk.make(1, 2),
        Chunk.of(1),
        Chunk.make(2, 1, 2, 3, 1, 2),
        Chunk.make(1, 2)
      )
      const splitSequence = Chunk.make(1, 2)
      const result = yield* $(pipe(
        Stream.flattenChunks(input),
        Stream.splitOnChunk(splitSequence),
        Stream.map(Chunk.size),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 0, 0, 1, 0])
    }))

  it.effect("splitOnChunk - preserves data", () =>
    Effect.gen(function*($) {
      const splitSequence = Chunk.make(0, 1)
      const stream = Stream.make(1, 1, 1, 1, 1, 1)
      const result = yield* $(pipe(
        stream,
        Stream.splitOnChunk(splitSequence),
        Stream.runCollect,
        Effect.map(Chunk.flatten)
      ))
      assert.deepStrictEqual(Array.from(result), [1, 1, 1, 1, 1, 1])
    }))

  it.effect("splitOnChunk - handles leftovers", () =>
    Effect.gen(function*($) {
      const splitSequence = Chunk.make(0, 1)
      const result = yield* $(pipe(
        Stream.fromChunks(Chunk.make(1, 0, 2, 0, 1, 2), Chunk.of(2)),
        Stream.splitOnChunk(splitSequence),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 0, 2], [2, 2]]
      )
    }))

  it.effect("splitOnChunk - works", () =>
    Effect.gen(function*($) {
      const splitSequence = Chunk.make(0, 1)
      const result = yield* $(pipe(
        Stream.make(1, 2, 0, 1, 3, 4, 0, 1, 5, 6, 5, 6),
        Stream.splitOnChunk(splitSequence),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4], [5, 6, 5, 6]]
      )
    }))

  it.effect("splitOnChunk - works from Chunks", () =>
    Effect.gen(function*($) {
      const splitSequence = Chunk.make(0, 1)
      const result = yield* $(pipe(
        Stream.fromChunks(
          Chunk.make(1, 2),
          splitSequence,
          Chunk.make(3, 4),
          splitSequence,
          Chunk.make(5, 6),
          Chunk.make(5, 6)
        ),
        Stream.splitOnChunk(splitSequence),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4], [5, 6, 5, 6]]
      )
    }))

  it.effect("splitOnChunk - single delimiter edge case", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(0),
        Stream.splitOnChunk(Chunk.make(0)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[]]
      )
    }))

  it.effect("splitOnChunk - no delimiter in data", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromChunks(Chunk.make(1, 2), Chunk.make(1, 2), Chunk.make(1, 2)),
        Stream.splitOnChunk(Chunk.make(1, 1)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2, 1, 2, 1, 2]]
      )
    }))

  it.effect("splitOnChunk - delimiter on the boundary", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromChunks(Chunk.make(1, 2), Chunk.make(1, 2)),
        Stream.splitOnChunk(Chunk.make(2, 1)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1], [2]]
      )
    }))
})
