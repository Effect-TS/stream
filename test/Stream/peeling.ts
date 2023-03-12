import * as Chunk from "@effect/data/Chunk"
import { constTrue, pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("peel", () =>
    Effect.gen(function*($) {
      const sink = Sink.take<number>(3)
      const [peeled, rest] = yield* $(pipe(
        Stream.fromChunks(Chunk.range(1, 3), Chunk.range(4, 6)),
        Stream.peel(sink),
        Effect.flatMap(([peeled, rest]) =>
          pipe(
            Stream.runCollect(rest),
            Effect.map((rest) => [peeled, rest])
          )
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(Array.from(peeled), [1, 2, 3])
      assert.deepStrictEqual(Array.from(rest), [4, 5, 6])
    }))

  it.effect("peel - propagates errors", () =>
    Effect.gen(function*($) {
      const stream = Stream.repeatEffect(Effect.fail("fail"))
      const sink = Sink.fold<Chunk.Chunk<number>, number>(
        Chunk.empty(),
        constTrue,
        Chunk.append
      )
      const result = yield* $(pipe(
        stream,
        Stream.peel(sink),
        Effect.exit,
        Effect.scoped
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("fail"))
    }))
})
