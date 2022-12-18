import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as Chunk from "@fp-ts/data/Chunk"
import { constVoid, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"

const findSink = <A>(a: A): Sink.Sink<never, void, A, A, A> =>
  pipe(
    Sink.fold<Option.Option<A>, A>(
      Option.none,
      Option.isNone,
      (_, v) => (a === v ? Option.some(a) : Option.none)
    ),
    Sink.mapEffect(Option.match(() => Effect.failSync(constVoid), Effect.succeed))
  )

const program = Effect.gen(function*($) {
  const chunk = Chunk.make(0, 1, 2, 20)
  const sink = findSink(20)
  const result = yield* $(pipe(
    Stream.fromChunk(chunk),
    Stream.run(pipe(sink, Sink.zipPar(sink))),
    Effect.either
  ))
  return result
})

Effect.unsafeRunPromiseExit(program).then((exit) => {
  console.log(exit)
})
