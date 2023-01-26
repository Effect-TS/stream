import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Either from "@fp-ts/core/Either"
import { identity, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import * as Chunk from "@fp-ts/data/Chunk"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("collect", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Either.left(1), Either.right(2), Either.left(3)),
        Stream.collect((either) =>
          Either.isRight(either) ?
            Option.some(either.right) :
            Option.none()
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [2])
    }))

  it.effect("collectEffect - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Either.left(1), Either.right(2), Either.left(3)),
        Stream.collectEffect((either) =>
          Either.isRight(either) ?
            Option.some(Effect.succeed(either.right * 2)) :
            Option.none()
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [4])
    }))

  it.effect("collectEffect - multiple chunks", () =>
    Effect.gen(function*($) {
      const chunks = Chunk.make(
        Chunk.make(Either.left(1), Either.right(2)),
        Chunk.make(Either.right(3), Either.left(4))
      )
      const result = yield* $(pipe(
        Stream.fromChunks(...chunks),
        Stream.collectEffect((either) =>
          Either.isRight(either) ?
            Option.some(Effect.succeed(either.right * 10)) :
            Option.none()
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [20, 30])
    }))

  it.effect("collectEffect - handles failures", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Either.left(1), Either.right(2), Either.left(3)),
        Stream.collectEffect(() => Option.some(Effect.fail("Ouch"))),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("collectEffect - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.collectEffect((n) =>
          n === 3 ?
            Option.some(Effect.fail("boom")) :
            Option.some(Effect.succeed(n))
        ),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.right(1), Either.right(2), Either.left("boom")]
      )
    }))

  it.effect("collectSome", () =>
    Effect.gen(function*($) {
      const stream = Stream.make(
        Option.some(1),
        Option.none() as Option.Option<number>,
        Option.some(2)
      )
      const { result1, result2 } = yield* $(Effect.struct({
        result1: pipe(stream, Stream.collectSome, Stream.runCollect),
        result2: pipe(stream, Stream.runCollect, Effect.map(Chunk.filterMap(identity)))
      }))
      assert.deepStrictEqual(Array.from(result1), Array.from(result2))
    }))

  it.effect("collectWhile - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Option.some(1), Option.some(2), Option.none(), Option.some(4)),
        Stream.collectWhile(identity),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2])
    }))

  it.effect("collectWhile - short circuits", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Option.some(1)),
        Stream.concat(Stream.fail("Ouch")),
        Stream.collectWhile((option) => Option.isNone(option) ? Option.some(1) : Option.none()),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.right(void 0))
    }))

  it.effect("collectWhileEffect - simple example", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Option.some(1), Option.some(2), Option.none(), Option.some(4)),
        Stream.collectWhileEffect((option) =>
          Option.isSome(option) ?
            Option.some(Effect.succeed(option.value * 2)) :
            Option.none()
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [2, 4])
    }))

  it.effect("collectWhileEffect - short circuits", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Option.some(1)),
        Stream.concat(Stream.fail("Ouch")),
        Stream.collectWhileEffect((option) =>
          Option.isNone(option) ?
            Option.some(Effect.succeed(1)) :
            Option.none()
        ),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.right(void 0))
    }))

  it.effect("collectWhileEffect - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(Option.some(1), Option.some(2), Option.none(), Option.some(3)),
        Stream.collectWhileEffect(() => Option.some(Effect.fail("Ouch"))),
        Stream.runDrain,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("collectWhileEffect - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.collectWhileEffect((n) =>
          n === 3 ?
            Option.some(Effect.fail("boom")) :
            Option.some(Effect.succeed(n))
        ),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [Either.right(1), Either.right(2), Either.left("boom")]
      )
    }))
})
