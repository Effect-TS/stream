import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Queue from "@effect/io/Queue"
import * as Ref from "@effect/io/Ref"
import * as Stream from "@effect/stream/Stream"
import { chunkCoordination } from "@effect/stream/test/utils/coordination"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import * as fc from "fast-check"
import { assert, describe } from "vitest"

const chunkArb = <A>(
  arb: fc.Arbitrary<A>,
  constraints?: fc.ArrayConstraints
): fc.Arbitrary<Chunk.Chunk<A>> => fc.array(arb, constraints).map(Chunk.fromIterable)

const grouped = <A>(arr: Array<A>, size: number): Array<Array<A>> => {
  const builder: Array<Array<A>> = []
  for (let i = 0; i < arr.length; i = i + size) {
    builder.push(arr.slice(i, i + size))
  }
  return builder
}

describe.concurrent("Stream", () => {
  it.it("concatAll", () => {
    fc.asyncProperty(fc.array(chunkArb(fc.integer())), async (chunks) => {
      const stream = pipe(
        Chunk.fromIterable(chunks),
        Chunk.map(Stream.fromChunk),
        Stream.concatAll
      )
      const actual = await Effect.unsafeRunPromise(Stream.runCollect(stream))
      const expected = Chunk.flatten(Chunk.fromIterable(chunks))
      assert.deepStrictEqual(Array.from(actual), Array.from(expected))
    })
  })

  it.effect("finalizer - happy path", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<string>()))
      yield* $(pipe(
        Stream.acquireRelease(
          pipe(ref, Ref.update(Chunk.append("Acquire"))),
          () => pipe(ref, Ref.update(Chunk.append("Release")))
        ),
        Stream.flatMap(() => Stream.finalizer(pipe(ref, Ref.update(Chunk.append("Use"))))),
        Stream.ensuring(pipe(ref, Ref.update(Chunk.append("Ensuring")))),
        Stream.runDrain
      ))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(Array.from(result), ["Acquire", "Use", "Release", "Ensuring"])
    }))

  it.effect("finalizer - finalizer is not run if stream is not pulled", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      yield* $(pipe(
        Stream.finalizer(pipe(ref, Ref.set(true))),
        Stream.toPull,
        Effect.scoped
      ))
      const result = yield* $(Ref.get(ref))
      assert.isFalse(result)
    }))

  it.it("fromChunk", () => {
    fc.asyncProperty(chunkArb(fc.integer()), async (chunk) => {
      const stream = Stream.fromChunk(chunk)
      const result = await Effect.unsafeRunPromise(Stream.runCollect(stream))
      assert.deepStrictEqual(Array.from(result), Array.from(chunk))
    })
  })

  it.it("fromChunks", () => {
    fc.asyncProperty(fc.array(chunkArb(fc.integer())), async (chunks) => {
      const stream = Stream.fromChunks(...chunks)
      const result = await Effect.unsafeRunPromise(Stream.runCollect(stream))
      assert.deepStrictEqual(
        Array.from(result),
        Array.from(Chunk.flatten(Chunk.fromIterable(chunks)))
      )
    })
  })

  it.effect("fromChunks - discards empty chunks", () =>
    Effect.gen(function*($) {
      const chunks = [Chunk.singleton(1), Chunk.empty<number>(), Chunk.singleton(1)]
      const result = yield* $(pipe(
        Stream.fromChunks(...chunks),
        Stream.toPull,
        Effect.flatMap((pull) =>
          pipe(
            Chunk.range(1, 3),
            Effect.forEach(() => pipe(Effect.either(pull), Effect.map(Either.map((chunk) => Array.from(chunk)))))
          )
        ),
        Effect.scoped
      ))
      assert.deepStrictEqual(Array.from(result), [
        Either.right([1]),
        Either.right([1]),
        Either.left(Option.none)
      ])
    }))

  it.effect("fromEffect - failure", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromEffect(Effect.fail("error")),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("error"))
    }))

  it.effect("fromEffectOption - emit one element with success", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromEffectOption(Effect.succeed(5)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [5])
    }))

  it.effect("fromEffectOption - emit one element with failure", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromEffectOption(Effect.fail(Option.some(5))),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left(5))
    }))

  it.effect("fromEffectOption - do not emit any element", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromEffectOption(Effect.fail(Option.none)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  // TODO(Mike/Max): after `@effect/test`
  // test("fromSchedule") {
  //   val schedule = Schedule.exponential(1.second) <* Schedule.recurs(5)
  //   val stream   = ZStream.fromSchedule(schedule)
  //   val zio = for {
  //     fiber <- stream.runCollect.fork
  //     _     <- TestClock.adjust(62.seconds)
  //     value <- fiber.join
  //   } yield value
  //   val expected = Chunk(1.seconds, 2.seconds, 4.seconds, 8.seconds, 16.seconds)
  //   assertZIO(zio)(equalTo(expected))
  // },

  it.effect("fromQueue - emits queued elements", () =>
    Effect.gen(function*($) {
      const coordination = yield* $(chunkCoordination([Chunk.make(1, 2)]))
      const fiber = yield* $(pipe(
        Stream.fromQueue(coordination.queue),
        Stream.collectWhileSuccess,
        Stream.flattenChunks,
        Stream.tap(() => coordination.proceed),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(coordination.offer)
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [1, 2])
    }))

  it.effect("fromQueue - chunks up to the max chunk size", () =>
    Effect.gen(function*($) {
      const queue = yield* $(Queue.unbounded<number>())
      yield* $(pipe(queue, Queue.offerAll([1, 2, 3, 4, 5, 6, 7])))
      const result = yield* $(pipe(
        Stream.fromQueue(queue, 2),
        Stream.mapChunks((chunk) => Chunk.singleton(Array.from(chunk))),
        Stream.take(3),
        Stream.runCollect
      ))
      assert.isTrue(Array.from(result).every((array) => array.length <= 2))
    }))

  // TODO(Mike/Max): after `@effect/stm`
  // test("fromTQueue") {
  //   TQueue.bounded[Int](5).commit.flatMap { tqueue =>
  //     ZIO.scoped {
  //       ZStream.fromTQueue(tqueue).toQueueUnbounded.flatMap { queue =>
  //         for {
  //           _      <- tqueue.offerAll(List(1, 2, 3)).commit
  //           first  <- ZStream.fromQueue(queue).take(3).runCollect
  //           _      <- tqueue.offerAll(List(4, 5)).commit
  //           second <- ZStream.fromQueue(queue).take(2).runCollect
  //         } yield assert(first)(equalTo(Chunk(1, 2, 3).map(Take.single))) &&
  //           assert(second)(equalTo(Chunk(4, 5).map(Take.single)))
  //       }
  //     }
  //   }
  // } @@ flaky,

  it.effect("iterate", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.iterate(1, (n) => n + 1),
        Stream.take(10),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(1, 10)))
    }))

  it.effect("range - includes min value and excludes max value", () =>
    Effect.gen(function*($) {
      const result = yield* $(Stream.runCollect(Stream.range(1, 2)))
      assert.deepStrictEqual(Array.from(result), [1])
    }))

  it.effect("range - two large ranges can be concatenated", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 1_000),
          Stream.concat(Stream.range(1_000, 2_000)),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(1, 1_999)))
    }))

  it.effect("range - two small ranges can be concatenated", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Stream.range(1, 10),
          Stream.concat(Stream.range(10, 20)),
          Stream.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(1, 19)))
    }))

  it.effect("range - emits no values when start >= end", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(1, 1),
        Stream.concat(Stream.range(2, 1)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("range - emits values in chunks of chunkSize", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(1, 10, 2),
        Stream.mapChunks((chunk) => Chunk.make(pipe(chunk, Chunk.reduce(0, (x, y) => x + y)))),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        [1 + 2, 3 + 4, 5 + 6, 7 + 8, 9]
      )
    }))

  it.it("rechunk", () => {
    fc.asyncProperty(fc.array(chunkArb(fc.integer())), fc.integer({ min: 1, max: 100 }), async (chunks, n) => {
      const stream = pipe(
        Stream.fromChunks(...chunks),
        Stream.rechunk(n),
        Stream.mapChunks(Chunk.singleton)
      )
      const actual = await Effect.unsafeRunPromise(Stream.runCollect(stream))
      const expected = chunks.map((chunk) => Array.from(chunk)).flat()
      assert.deepStrictEqual(
        Array.from(actual).map((chunk) => Array.from(chunk)),
        grouped(expected, n)
      )
    })
  })

  it.effect("unfold", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.unfold(0, (n) =>
          n < 10 ?
            Option.some([n, n + 1] as const) :
            Option.none),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(0, 9)))
    }))

  it.effect("unfoldChunk", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.unfoldChunk(0, (n) =>
          n < 10 ?
            Option.some([Chunk.make(n, n + 1), n + 2] as const) :
            Option.none),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(0, 9)))
    }))

  it.effect("unfoldChunkEffect", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.unfoldChunkEffect(0, (n) =>
          n < 10 ?
            Effect.succeed(Option.some([Chunk.make(n, n + 1), n + 2] as const)) :
            Effect.succeed(Option.none)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(0, 9)))
    }))

  it.effect("unfoldEffect", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.unfoldEffect(0, (n) =>
          n < 10 ?
            Effect.succeed(Option.some([n, n + 1] as const)) :
            Effect.succeed(Option.none)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(0, 9)))
    }))
})
