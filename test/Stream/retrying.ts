import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Schedule from "@effect/io/Schedule"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("retry - retries a failing stream", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const stream = pipe(
        Stream.fromEffect(pipe(ref, Ref.getAndUpdate((n) => n + 1))),
        Stream.concat(Stream.fail(Option.none))
      )
      const result = yield* $(pipe(
        stream,
        Stream.retry(Schedule.forever()),
        Stream.take(2),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1])
    }))

  it.effect("retry - cleans up resources before restarting the stream", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const stream = pipe(
        Effect.addFinalizer(() => pipe(ref, Ref.getAndUpdate((n) => n + 1))),
        Effect.as(
          pipe(
            Stream.fromEffect(Ref.get(ref)),
            Stream.concat(Stream.fail(Option.none))
          )
        ),
        Stream.unwrapScoped
      )
      const result = yield* $(pipe(
        stream,
        Stream.retry(Schedule.forever()),
        Stream.take(2),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [0, 1])
    }))

  // TODO(Mike/Max): replace with TestClock after `@effect/test`
  // it.effect("retry - retries a failing stream according to a schedule", () =>
  //   Effect.gen(function*($) {
  //     const ref = yield* $(Ref.make(Chunk.empty<number>()))
  //     const stream = pipe(
  //       Stream.fromEffect(
  //         pipe(
  //           Clock.currentTimeMillis(),
  //           Effect.flatMap((n) => pipe(ref, Ref.update(Chunk.prepend(n))))
  //         )
  //       ),
  //       Stream.flatMap(() => Stream.fail(Option.none))
  //     )
  //     const fiber = yield* $(pipe(
  //       stream,
  //       Stream.retry(Schedule.exponential(Duration.seconds(1))),
  //       Stream.take(3),
  //       Stream.runDrain,
  //       Effect.fork
  //     ))
  //     yield* $(TestClock.adjust(Duration.seconds(1)))
  //     yield* $(TestClock.adjust(Duration.seconds(2)))
  //     yield* $(Fiber.interrupt(fiber))
  //     const result = yield* $(pipe(Ref.get(ref), Effect.map(Chunk.map((n) => new Date(n).getSeconds()))))
  //     assert.deepStrictEqual(Array.from(result), [3000, 1000, 0])
  //   }))

  // TODO(Mike/Max): after `@effect/test`
  //   test("reset the schedule after a successful pull") {
  //     for {
  //       times <- Ref.make(List.empty[java.time.Instant])
  //       ref   <- Ref.make(0)
  //       stream =
  //         ZStream
  //           .fromZIO(Clock.instant.flatMap(time => times.update(time +: _) *> ref.updateAndGet(_ + 1)))
  //           .flatMap { attemptNr =>
  //             if (attemptNr == 3 || attemptNr == 5) ZStream.succeed(attemptNr) else ZStream.fail(None)
  //           }
  //           .forever
  //       streamFib <- stream
  //                      .retry(Schedule.exponential(1.second))
  //                      .take(2)
  //                      .runDrain
  //                      .fork
  //       _       <- TestClock.adjust(1.second)
  //       _       <- TestClock.adjust(2.second)
  //       _       <- TestClock.adjust(1.second)
  //       _       <- streamFib.join
  //       results <- times.get.map(_.map(_.getEpochSecond.toInt))
  //     } yield assert(results)(equalTo(List(4, 3, 3, 1, 0)))
  //   }
  // ),
})
