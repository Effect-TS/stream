import * as Chunk from "@effect/data/Chunk"
import * as Equal from "@effect/data/Equal"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Stream from "@effect/stream/Stream"
import * as util from "node:util"

// See original test here:
// https://github.com/zio/zio/blob/e4afc377276907b9b42c4fa026bae8278a886ec2/streams-tests/shared/src/test/scala/zio/stream/ZStreamSpec.scala#L4297

const chunks = Chunk.make(
  Chunk.range(1, 3),
  Chunk.range(4, 6),
  Chunk.range(7, 9)
)
const program = Effect.gen(function*($) {
  const stream = Stream.fromChunks(...chunks)
  const previous = pipe(
    Stream.make(Option.none),
    Stream.concat(pipe(stream, Stream.map(Option.some)))
  )
  const next = pipe(
    stream,
    Stream.drop(1),
    Stream.map(Option.some),
    Stream.concat(Stream.make(Option.none))
  )
  const { result1, result2 } = yield* $(pipe(
    Effect.all({
      result1: pipe(
        stream,
        Stream.zipWithPreviousAndNext,
        Stream.runCollect
      ),
      result2: pipe(
        previous,
        Stream.zip(stream),
        Stream.zipFlatten(next),
        Stream.runCollect
      )
    })
  ))
  const equal = Equal.equals(result2)(result1)
  return { equal, result1: Array.from(result1), result2: Array.from(result2) }
})

Effect.runPromiseExit(program).then((exit) => {
  if (Exit.isSuccess(exit)) {
    console.log(util.inspect(exit.value, { depth: null, colors: true }))
  }
})
