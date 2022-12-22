import * as Effect from "@effect/io/Effect"
import * as Random from "@effect/io/Random"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import { constVoid, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

const findSink = <A>(a: A): Sink.Sink<never, void, A, A, A> =>
  pipe(
    Sink.fold<Option.Option<A>, A>(
      Option.none,
      Option.isNone,
      (_, v) => (a === v ? Option.some(a) : Option.none)
    ),
    Sink.mapEffect(Option.match(() => Effect.failSync(constVoid), Effect.succeed))
  )

const zipParLaw = <A, B, C, E>(
  stream: Stream.Stream<never, never, A>,
  sink1: Sink.Sink<never, E, A, A, B>,
  sink2: Sink.Sink<never, E, A, A, C>
): Effect.Effect<never, never, boolean> =>
  pipe(
    Effect.struct({
      zb: pipe(stream, Stream.run(sink1), Effect.either),
      zc: pipe(stream, Stream.run(sink2), Effect.either),
      zbc: pipe(stream, Stream.run(pipe(sink1, Sink.zipPar(sink2))), Effect.either)
    }),
    Effect.map(({ zb, zbc, zc }) =>
      pipe(
        zbc,
        Either.match(
          (e) => (Either.isLeft(zb) && zb.left === e) || (Either.isLeft(zc) && zc.left === e),
          ([b, c]) => Either.isRight(zb) && zb.right === b && Either.isRight(zc) && zc.right === c
        )
      )
    )
  )

describe.concurrent("Sink", () => {
  it.effect("zipParLeft", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.run(pipe(
          Sink.head(),
          Sink.zipParLeft(Sink.succeed("hello"))
        ))
      ))
      assert.deepStrictEqual(result, Option.some(1))
    }))

  it.effect("zipParRight", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3),
        Stream.run(pipe(
          Sink.head(),
          Sink.zipParRight(Sink.succeed("hello"))
        ))
      ))
      assert.strictEqual(result, "hello")
    }))

  it.effect("zipWithPar - coherence", () =>
    Effect.gen(function*($) {
      const ints = yield* $(Effect.unfold(0, (n) =>
        pipe(
          Random.nextIntBetween(0, 10),
          Effect.map((i) => n < 20 ? Option.some([i, n + 1] as const) : Option.none)
        )))
      const success1 = yield* $(Random.nextBoolean())
      const success2 = yield* $(Random.nextBoolean())
      const chunk = pipe(
        ints,
        Chunk.concat(success1 ? Chunk.singleton(20) : Chunk.empty<number>()),
        Chunk.concat(success2 ? Chunk.singleton(40) : Chunk.empty<number>())
      )
      const result = yield* $(
        zipParLaw(
          Stream.fromIterableEffect(Random.shuffle(chunk)),
          findSink(20),
          findSink(40)
        )
      )
      assert.isTrue(result)
    }))
})
