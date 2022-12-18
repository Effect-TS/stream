import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as GroupBy from "@effect/stream/GroupBy"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Either from "@fp-ts/data/Either"
import { identity, pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("groupBy - values", () =>
    Effect.gen(function*($) {
      const words = pipe(
        Chunk.makeBy(() => Chunk.range(0, 99))(100),
        Chunk.flatten,
        Chunk.map((n) => String(n))
      )
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKey(identity, 8192),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        Array.from({ length: 100 }, (_, i) => i).map((n) => [String(n), 100] as const)
      )
    }))

  it.effect("groupBy - first", () =>
    Effect.gen(function*($) {
      const words = pipe(
        Chunk.makeBy(() => Chunk.range(0, 99))(1_000),
        Chunk.flatten,
        Chunk.map((n) => String(n))
      )
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKey(identity, 1050),
        GroupBy.first(2),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [["0", 1_000], ["1", 1_000]])
    }))

  it.effect("groupBy - filter", () =>
    Effect.gen(function*($) {
      const words = Array.from({ length: 100 }, () => Array.from({ length: 100 }, (_, i) => i)).flat()
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.groupByKey(identity, 1050),
        GroupBy.filter((n) => n <= 5),
        GroupBy.evaluate((key, stream) =>
          pipe(
            Stream.runCollect(stream),
            Effect.map((leftover) => [key, leftover.length] as const),
            Stream.fromEffect
          )
        ),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [
        [0, 100],
        [1, 100],
        [2, 100],
        [3, 100],
        [4, 100],
        [5, 100]
      ])
    }))

  it.effect("groupBy - outer errors", () =>
    Effect.gen(function*($) {
      const words = ["abc", "test", "test", "foo"]
      const result = yield* $(pipe(
        Stream.fromIterable(words),
        Stream.concat(Stream.fail("boom")),
        Stream.groupByKey(identity),
        GroupBy.evaluate((_, stream) => Stream.drain(stream)),
        Stream.runCollect,
        Effect.either
      ))
      assert.deepStrictEqual(result, Either.left("boom"))
    }))

  it.effect("grouped - sanity check", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1, 2, 3, 4, 5),
        Stream.grouped(2),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result).map((chunk) => Array.from(chunk)),
        [[1, 2], [3, 4], [5]]
      )
    }))

  it.effect("grouped - group size is correct", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.range(0, 100),
        Stream.grouped(10),
        Stream.map(Chunk.size),
        Stream.runCollect
      ))
      assert.deepStrictEqual(
        Array.from(result),
        Array.from({ length: 10 }, () => 10)
      )
    }))

  it.effect("grouped - does not emit empty chunks", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.fromIterable(Chunk.empty<number>()),
        Stream.grouped(5),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [])
    }))

  it.effect("grouped - emits elements properly when a failure occurs", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<Array<number>>()))
      const streamChunks = Stream.fromChunks(Chunk.range(1, 4), Chunk.range(5, 7), Chunk.singleton(8))
      const stream = pipe(
        streamChunks,
        Stream.concat(Stream.fail("Ouch")),
        Stream.grouped(3)
      )
      const either = yield* $(pipe(
        stream,
        Stream.mapEffect((chunk) => pipe(ref, Ref.update(Chunk.append(Array.from(chunk))))),
        Stream.runCollect,
        Effect.either
      ))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(either, Either.left("Ouch"))
      assert.deepStrictEqual(Array.from(result), [[1, 2, 3], [4, 5, 6], [7, 8]])
    }))

  // TODO(Mike/Max): after `@effect/test`
  // suite("groupedWithin")(
  //   test("group based on time passed") {
  //     assertWithChunkCoordination(List(Chunk(1, 2), Chunk(3, 4), Chunk.single(5))) { c =>
  //       val stream = ZStream
  //         .fromQueue(c.queue)
  //         .collectWhileSuccess
  //         .flattenChunks
  //         .groupedWithin(10, 2.seconds)
  //         .tap(_ => c.proceed)

  //       assertZIO(for {
  //         f      <- stream.runCollect.fork
  //         _      <- c.offer *> TestClock.adjust(2.seconds) *> c.awaitNext
  //         _      <- c.offer *> TestClock.adjust(2.seconds) *> c.awaitNext
  //         _      <- c.offer
  //         result <- f.join
  //       } yield result)(equalTo(Chunk(Chunk(1, 2), Chunk(3, 4), Chunk(5))))
  //     }
  //   } @@ timeout(10.seconds) @@ flaky,
  //   test("group based on time passed (#5013)") {
  //     val chunkResult = Chunk(
  //       Chunk(1, 2, 3),
  //       Chunk(4, 5, 6),
  //       Chunk(7, 8, 9),
  //       Chunk(10, 11, 12, 13, 14, 15, 16, 17, 18, 19),
  //       Chunk(20, 21, 22, 23, 24, 25, 26, 27, 28, 29)
  //     )

  //     assertWithChunkCoordination((1 to 29).map(Chunk.single).toList) { c =>
  //       for {
  //         latch <- ZStream.Handoff.make[Unit]
  //         ref   <- Ref.make(0)
  //         fiber <- ZStream
  //                    .fromQueue(c.queue)
  //                    .collectWhileSuccess
  //                    .flattenChunks
  //                    .tap(_ => c.proceed)
  //                    .groupedWithin(10, 3.seconds)
  //                    .tap(chunk => ref.update(_ + chunk.size) *> latch.offer(()))
  //                    .run(ZSink.take(5))
  //                    .fork
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         result0 <- latch.take *> ref.get
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         result1 <- latch.take *> ref.get
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         _       <- c.offer *> TestClock.adjust(1.second) *> c.awaitNext
  //         result2 <- latch.take *> ref.get
  //         // This part is to make sure schedule clock is being restarted
  //         // when the specified amount of elements has been reached
  //         _       <- TestClock.adjust(2.second) *> (c.offer *> c.awaitNext).repeatN(9)
  //         result3 <- latch.take *> ref.get
  //         _       <- c.offer *> c.awaitNext *> TestClock.adjust(2.second) *> (c.offer *> c.awaitNext).repeatN(8)
  //         result4 <- latch.take *> ref.get
  //         result  <- fiber.join
  //       } yield assert(result)(equalTo(chunkResult)) &&
  //         assert(result0)(equalTo(3)) &&
  //         assert(result1)(equalTo(6)) &&
  //         assert(result2)(equalTo(9)) &&
  //         assert(result3)(equalTo(19)) &&
  //         assert(result4)(equalTo(29))
  //     }
  //   },
  //   test("group immediately when chunk size is reached") {
  //     assertZIO(ZStream(1, 2, 3, 4).groupedWithin(2, 10.seconds).runCollect)(
  //       equalTo(Chunk(Chunk(1, 2), Chunk(3, 4)))
  //     )
  //   }
  // ),
})
