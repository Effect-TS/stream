import * as Chunk from "@effect/data/Chunk"
import { pipe } from "@effect/data/Function"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Queue from "@effect/io/Queue"
import * as Stream from "@effect/stream/Stream"
import * as Take from "@effect/stream/Take"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("toQueue", () =>
    Effect.gen(function*($) {
      const chunk = Chunk.make(1, 2, 3)
      const stream = pipe(
        Stream.fromChunk(chunk),
        Stream.flatMap(Stream.succeed)
      )
      const result = yield* $(pipe(
        stream,
        Stream.toQueue({ capacity: 1_000 }),
        Effect.flatMap((queue) =>
          pipe(
            Queue.size(queue),
            Effect.repeatWhile((size) => size !== chunk.length + 1),
            Effect.zipRight(Queue.takeAll(queue))
          )
        ),
        Effect.scoped
      ))
      const expected = pipe(
        chunk,
        Chunk.map(Take.of),
        Chunk.append(Take.end)
      )
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))

  it.effect("toQueueUnbounded", () =>
    Effect.gen(function*($) {
      const chunk = Chunk.make(1, 2, 3)
      const stream = pipe(
        Stream.fromChunk(chunk),
        Stream.flatMap(Stream.succeed)
      )
      const result = yield* $(pipe(
        Stream.toQueue(stream, { strategy: "unbounded" }),
        Effect.flatMap((queue) =>
          pipe(
            Queue.size(queue),
            Effect.repeatWhile((size) => size !== chunk.length + 1),
            Effect.zipRight(Queue.takeAll(queue))
          )
        ),
        Effect.scoped
      ))
      const expected = pipe(
        chunk,
        Chunk.map(Take.of),
        Chunk.append(Take.end)
      )
      assert.deepStrictEqual(Array.from(result), Array.from(expected))
    }))

  it.effect("toQueueOfElements - propagates defects", () =>
    Effect.gen(function*($) {
      const queue = yield* $(pipe(
        Stream.dieMessage("die"),
        Stream.toQueueOfElements({ capacity: 1 }),
        Effect.flatMap(Queue.take),
        Effect.scoped
      ))
      assert.deepStrictEqual(Exit.unannotate(queue), Exit.die(Cause.RuntimeException("die")))
    }))
})
