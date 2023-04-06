import * as Chunk from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import * as Either from "@effect/data/Either"
import * as Option from "@effect/data/Option"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Foreign", () => {
  it.effect("Tag", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        tag,
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Either.right", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()

      const result = yield* $(
        Either.right(10),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Either.left", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Either.left(10),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left(10))
    }))

  it.effect("Option.some", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Option.some(10),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, [10])
    }))

  it.effect("Option.none", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Option.none(),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left(Cause.NoSuchElementException()))
    }))

  it.effect("Effect.fail", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Effect.fail("ok"),
        Stream.runCollect,
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.left("ok"))
    }))

  it.effect("Effect.succeed", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(
        Effect.succeed("ok"),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.either,
        Effect.provideService(tag, 10)
      )
      assert.deepEqual(result, Either.right(["ok"]))
    }))
})
