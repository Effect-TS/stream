import * as Either from "@effect/data/Either"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("some", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.succeed(Option.some(1)),
        Stream.concat(Stream.succeed(Option.none())),
        Stream.some,
        Stream.runCollect,
        Effect.either
      )
      assert.deepStrictEqual(result, Either.left(Option.none()))
    }))

  it.effect("some", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.succeed(Option.some(1)),
        Stream.concat(Stream.succeed(Option.none())),
        Stream.someOrElse(() => -1),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), [1, -1])
    }))

  it.effect("someOrFail", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.succeed(Option.some(1)),
        Stream.concat(Stream.succeed(Option.none())),
        Stream.someOrFail(() => -1),
        Stream.runCollect,
        Effect.either
      )
      assert.deepStrictEqual(result, Either.left(-1))
    }))
})
