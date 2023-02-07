import * as Chunk from "@effect/data/Chunk"
import * as Effect from "@effect/io/Effect"
import * as Random from "@effect/io/Random"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Either from "@fp-ts/core/Either"
import { constVoid, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import { assert, describe } from "vitest"

const findSink = <A>(a: A): Sink.Sink<never, void, A, A, A> =>
  pipe(
    Sink.fold<Option.Option<A>, A>(
      Option.none(),
      Option.isNone,
      (_, v) => (a === v ? Option.some(a) : Option.none())
    ),
    Sink.mapEffect(Option.match(() => Effect.failSync(constVoid), Effect.succeed))
  )

const sinkRaceLaw = <E, A, L>(
  stream: Stream.Stream<never, never, A>,
  sink1: Sink.Sink<never, E, A, L, A>,
  sink2: Sink.Sink<never, E, A, L, A>
): Effect.Effect<never, never, boolean> =>
  pipe(
    Effect.struct({
      result1: pipe(stream, Stream.run(sink1), Effect.either),
      result2: pipe(stream, Stream.run(sink2), Effect.either),
      result3: pipe(stream, Stream.run(pipe(sink1, Sink.raceBoth(sink2))), Effect.either)
    }),
    Effect.map(({ result1, result2, result3 }) =>
      pipe(
        result3,
        Either.match(
          () => Either.isLeft(result1) || Either.isLeft(result2),
          Either.match(
            (a) => Either.isRight(result1) && result1.right === a,
            (a) => Either.isRight(result2) && result2.right === a
          )
        )
      )
    )
  )

describe.concurrent("Sink", () => {
  it.effect("raceBoth", () =>
    Effect.gen(function*($) {
      const ints = yield* $(Effect.unfold(0, (n) =>
        pipe(
          Random.nextIntBetween(0, 10),
          Effect.map((i) => n <= 20 ? Option.some([i, n + 1] as const) : Option.none())
        )))
      const success1 = yield* $(Random.nextBoolean())
      const success2 = yield* $(Random.nextBoolean())
      const chunk = pipe(
        ints,
        Chunk.concat(success1 ? Chunk.of(20) : Chunk.empty<number>()),
        Chunk.concat(success2 ? Chunk.of(40) : Chunk.empty<number>())
      )
      const result = yield* $(
        sinkRaceLaw(
          Stream.fromIterableEffect(Random.shuffle(chunk)),
          findSink(20),
          findSink(40)
        )
      )
      assert.isTrue(result)
    }))
})
