import * as Chunk from "@effect/data/Chunk"
import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("tap", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const result = yield* $(pipe(
        Stream.make(1, 1),
        Stream.tap((i) => Ref.update(ref, (n) => i + n)),
        Stream.runCollect
      ))
      const sum = yield* $(Ref.get(ref))
      assert.strictEqual(sum, 2)
      assert.deepStrictEqual(Array.from(result), [1, 1])
    }))

  it.effect("tap - laziness on chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.tap((n) => pipe(Effect.fail("error"), Effect.when(() => n === 3))),
        Stream.either,
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [
        Either.right(1),
        Either.right(2),
        Either.left("error")
      ])
    }))

  it.effect("tapBoth", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make<Array<string>>([]))
      const result = yield* $(pipe(
        Stream.make("hello", "world"),
        Stream.concat(Stream.fail("boom")),
        Stream.tapBoth({
          onSuccess: (v) => Ref.update(ref, (s) => [...s, `s:${v}`]),
          onFailure: (e) => Ref.update(ref, (s) => [...s, `f:${e}`])
        }),
        Stream.runCollect,
        Effect.either
      ))

      assert.deepStrictEqual(result, Either.left("boom"))
      const sequence = yield* $(Ref.get(ref))
      assert.deepStrictEqual(sequence, ["s:hello", "s:world", "f:boom"])
    }))

  it.effect("tapBoth - fail in success handler is not piped through fail handler", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(true))
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.tapBoth({
          onSuccess: (n) => pipe(Effect.fail("error"), Effect.when(() => n === 3)),
          onFailure: () => Ref.update(ref, () => false)
        }),
        Stream.either,
        Stream.runCollect
      ))

      assert.deepStrictEqual(Array.from(result), [
        Either.right(1),
        Either.right(2),
        Either.left("error")
      ])
      const flag = yield* $(Ref.get(ref))
      assert.isTrue(flag)
    }))

  it.effect("tapError", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(""))
      const result = yield* $(pipe(
        Stream.make(1, 1),
        Stream.concat(Stream.fail("Ouch")),
        Stream.tapError((e) => Ref.update(ref, (s) => s + e)),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("Ouch"))
    }))

  it.effect("tapSink - sink that is done after stream", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const sink = Sink.forEach((i: number) => Ref.update(ref, (n) => i + n))
      const result = yield* $(pipe(
        Stream.make(1, 1, 2, 3, 5, 8),
        Stream.tapSink(sink),
        Stream.runCollect
      ))
      const sum = yield* $(Ref.get(ref))
      assert.strictEqual(sum, 20)
      assert.deepStrictEqual(Array.from(result), [1, 1, 2, 3, 5, 8])
    }))

  it.effect("tapSink - sink that is done before stream", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const sink = pipe(
        Sink.take<number>(3),
        Sink.map(Chunk.reduce(0, (x, y) => x + y)),
        Sink.mapEffect((i) => Ref.update(ref, (n) => n + i))
      )
      const result = yield* $(pipe(
        Stream.make(1, 1, 2, 3, 5, 8),
        Stream.rechunk(1),
        Stream.tapSink(sink),
        Stream.runCollect
      ))
      const sum = yield* $(Ref.get(ref))
      assert.strictEqual(sum, 4)
      assert.deepStrictEqual(Array.from(result), [1, 1, 2, 3, 5, 8])
    }))

  it.effect("tapSink - sink that fails before stream", () =>
    Effect.gen(function*($) {
      const sink = Sink.fail("error")
      const result = yield* $(pipe(
        Stream.never,
        Stream.tapSink(sink),
        Stream.runCollect,
        Effect.flip
      ))
      assert.strictEqual(result, "error")
    }))

  it.effect("tapSink - does not read ahead", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const sink = Sink.forEach((i: number) => Ref.update(ref, (n) => i + n))
      yield* $(pipe(
        Stream.make(1, 2, 3, 4, 5),
        Stream.rechunk(1),
        Stream.forever,
        Stream.tapSink(sink),
        Stream.take(3),
        Stream.runDrain
      ))
      const result = yield* $(Ref.get(ref))
      assert.strictEqual(result, 6)
    }))
})
