import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Either from "@fp-ts/core/Either"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/core/Function"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("as", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.succeed(1), Sink.as("as")))
        )
      )
      assert.strictEqual(result, "as")
    }))

  it.effect("contramap - happy path", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramap((input: string) => Number.parseInt(input))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink)))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("contramap - error", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.fail("Ouch"),
        Sink.contramap((input: string) => Number.parseInt(input))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("contramapChunks - happy path", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramapChunks<string, number>(Chunk.map(Number.parseInt))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink)))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("contramapChunks - error", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.fail("Ouch"),
        Sink.contramapChunks<string, number>(Chunk.map(Number.parseInt))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("contramapEffect - happy path", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramapEffect((s: string) => Effect.attempt(() => Number.parseInt(s)))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink)))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("contramapEffect - error", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.fail("Ouch"),
        Sink.contramapEffect((s: string) => Effect.attempt(() => Number.parseInt(s)))
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("contramapEffect - error in transformation", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramapEffect((s: string) =>
          Effect.attempt(() => {
            const result = Number.parseInt(s)
            if (Number.isNaN(result)) {
              throw Cause.RuntimeException(`Cannot parse "${s}" to an integer`)
            }
            return result
          })
        )
      )
      const result = yield* $(pipe(Stream.make("1", "a"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left(Cause.RuntimeException("Cannot parse \"a\" to an integer")))
    }))

  it.effect("contramapChunksEffect - happy path", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramapChunksEffect((chunk: Chunk.Chunk<string>) =>
          pipe(
            chunk,
            Effect.forEach((s) => Effect.attempt(() => Number.parseInt(s)))
          )
        )
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink)))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3])
    }))

  it.effect("contramapChunksEffect - error", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.fail("Ouch"),
        Sink.contramapChunksEffect((chunk: Chunk.Chunk<string>) =>
          pipe(
            chunk,
            Effect.forEach((s) => Effect.attempt(() => Number.parseInt(s)))
          )
        )
      )
      const result = yield* $(pipe(Stream.make("1", "2", "3"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("contramapChunksEffect - error in transformation", () =>
    Effect.gen(function*($) {
      const sink = pipe(
        Sink.collectAll<number>(),
        Sink.contramapChunksEffect((chunk: Chunk.Chunk<string>) =>
          pipe(
            chunk,
            Effect.forEach((s) =>
              Effect.attempt(() => {
                const result = Number.parseInt(s)
                if (Number.isNaN(result)) {
                  throw Cause.RuntimeException(`Cannot parse "${s}" to an integer`)
                }
                return result
              })
            )
          )
        )
      )
      const result = yield* $(pipe(Stream.make("1", "a"), Stream.run(sink), Effect.either))
      assert.deepStrictEqual(result, Either.left(Cause.RuntimeException("Cannot parse \"a\" to an integer")))
    }))

  it.effect("map", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.succeed(1), Sink.map((n) => `${n}`)))
        )
      )
      assert.strictEqual(result, "1")
    }))

  it.effect("mapEffect - happy path", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.succeed(1), Sink.mapEffect((n) => Effect.succeed(n + 1))))
        )
      )
      assert.strictEqual(result, 2)
    }))

  it.effect("mapEffect - error", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.succeed(1), Sink.mapEffect(() => Effect.fail("fail")))),
          Effect.flip
        )
      )
      assert.strictEqual(result, "fail")
    }))

  it.effect("mapError", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.run(pipe(Sink.fail("fail"), Sink.mapError((s) => s + "!"))),
          Effect.either
        )
      )
      assert.deepStrictEqual(result, Either.left("fail!"))
    }))
})
