import * as Chunk from "@effect/data/Chunk"
import * as Effect from "@effect/io/Effect"
import * as GroupBy from "@effect/stream/GroupBy"
import * as Stream from "@effect/stream/Stream"
import { identity, pipe } from "@fp-ts/core/Function"

const program = Effect.gen(function*($) {
  const words = pipe(
    Chunk.makeBy(() => Chunk.range(0, 99))(100),
    Chunk.flatten,
    Chunk.map((n) => String(n))
  )
  const result = yield* $(pipe(
    Stream.fromIterable(words),
    Stream.groupByKeyBuffer(identity, 8192),
    GroupBy.evaluate((key, stream) =>
      pipe(
        Stream.runCollect(stream),
        Effect.map((leftover) => [key, leftover.length] as const),
        Stream.fromEffect
      )
    ),
    Stream.runCollect
  ))
  console.log(
    Array.from(result),
    Array.from({ length: 100 }, (_, i) => i).map((n) => [String(n), 100] as const)
  )
})

Effect.runFork(program)
