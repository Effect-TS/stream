import * as Chunk from "@effect/data/Chunk"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("intersperse - several values", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.map(String),
        Stream.intersperse("."),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["1", ".", "2", ".", "3", ".", "4"])
    }))

  it.effect("intersperseAffixes - several values", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4),
        Stream.map(String),
        Stream.intersperseAffixes("[", ".", "]"),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["[", "1", ".", "2", ".", "3", ".", "4", "]"])
    }))

  it.effect("intersperse - single value", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.map(String),
        Stream.intersperse("."),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["1"])
    }))

  it.effect("intersperseAffixes - single value", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.map(String),
        Stream.intersperseAffixes("[", ".", "]"),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["[", "1", "]"])
    }))

  it.effect("intersperse - several from repeat effect (ZIO #3729)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.repeatEffect(Effect.succeed(42)),
        Stream.map(String),
        Stream.take(4),
        Stream.intersperse("."),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["42", ".", "42", ".", "42", ".", "42"])
    }))

  it.effect("intersperse - several from repeat effect chunk single element (ZIO #3729)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.repeatEffectChunk(Effect.succeed(Chunk.of(42))),
        Stream.map(String),
        Stream.intersperse("."),
        Stream.take(4),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["42", ".", "42", "."])
    }))
})
