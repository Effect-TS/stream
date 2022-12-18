import * as Effect from "@effect/io/Effect"
// import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("paginate", () =>
    Effect.gen(function*($) {
      const s: readonly [number, Array<number>] = [0, [1, 2, 3]]
      const result = yield* $(pipe(
        Stream.paginate(s, ([n, nums]) =>
          nums.length === 0 ?
            [n, Option.none] as const :
            [n, Option.some([nums[0], nums.slice(1)] as const)] as const),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3])
    }))

  it.effect("paginateEffect", () =>
    Effect.gen(function*($) {
      const s: readonly [number, Array<number>] = [0, [1, 2, 3]]
      const result = yield* $(pipe(
        Stream.paginateEffect(s, ([n, nums]) =>
          nums.length === 0 ?
            Effect.succeed([n, Option.none] as const) :
            Effect.succeed([n, Option.some([nums[0], nums.slice(1)] as const)] as const)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3])
    }))

  it.effect("paginateChunk", () =>
    Effect.gen(function*($) {
      const s: readonly [Chunk.Chunk<number>, Array<number>] = [Chunk.singleton(0), [1, 2, 3, 4, 5]]
      const pageSize = 2
      const result = yield* $(pipe(
        Stream.paginateChunk(s, ([chunk, nums]) =>
          nums.length === 0 ?
            [chunk, Option.none] as const :
            [
              chunk,
              Option.some(
                [
                  Chunk.fromIterable(nums.slice(0, pageSize)),
                  nums.slice(pageSize)
                ] as const
              )
            ] as const),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3, 4, 5])
    }))

  it.effect("paginateChunkEffect", () =>
    Effect.gen(function*($) {
      const s: readonly [Chunk.Chunk<number>, Array<number>] = [Chunk.singleton(0), [1, 2, 3, 4, 5]]
      const pageSize = 2
      const result = yield* $(pipe(
        Stream.paginateChunkEffect(s, ([chunk, nums]) =>
          nums.length === 0 ?
            Effect.succeed([chunk, Option.none] as const) :
            Effect.succeed(
              [
                chunk,
                Option.some(
                  [
                    Chunk.fromIterable(nums.slice(0, pageSize)),
                    nums.slice(pageSize)
                  ] as const
                )
              ] as const
            )),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1, 2, 3, 4, 5])
    }))
})
