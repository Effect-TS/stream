import * as Clock from "@effect/io/Clock"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal/testing/testClock"
import * as Ref from "@effect/io/Ref"
import * as Schedule from "@effect/io/Schedule"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Duration from "@fp-ts/data/Duration"
import { pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("retry - retries a failing stream", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const stream = pipe(
        Stream.fromEffect(Ref.getAndUpdate(ref, (n) => n + 1)),
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
        Effect.addFinalizer(() => Ref.getAndUpdate(ref, (n) => n + 1)),
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

  it.effect("retry - retries a failing stream according to a schedule", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<number>()))
      const stream = pipe(
        Stream.fromEffect(
          pipe(
            Clock.currentTimeMillis(),
            Effect.flatMap((n) => Ref.update(ref, Chunk.prepend(n)))
          )
        ),
        Stream.flatMap(() => Stream.fail(Option.none))
      )
      const fiber = yield* $(pipe(
        stream,
        Stream.retry(Schedule.exponential(Duration.seconds(1))),
        Stream.take(3),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      yield* $(TestClock.adjust(Duration.seconds(2)))
      yield* $(Fiber.interrupt(fiber))
      const result = yield* $(pipe(Ref.get(ref), Effect.map(Chunk.map((n) => new Date(n).getSeconds()))))
      assert.deepStrictEqual(Array.from(result), [3, 1, 0])
    }))

  it.effect("retry - reset the schedule after a successful pull", () =>
    Effect.gen(function*($) {
      const times = yield* $(Ref.make(Chunk.empty<number>()))
      const ref = yield* $(Ref.make(0))
      const effect = pipe(
        Clock.currentTimeMillis(),
        Effect.flatMap((time) =>
          pipe(
            Ref.update(times, Chunk.prepend(time / 1000)),
            Effect.zipRight(Ref.updateAndGet(ref, (n) => n + 1))
          )
        )
      )
      const stream = pipe(
        Stream.fromEffect(effect),
        Stream.flatMap((attempt) =>
          attempt === 3 || attempt === 5 ?
            Stream.succeed(attempt) :
            Stream.fail(Option.none)
        ),
        Stream.forever
      )
      const fiber = yield* $(pipe(
        stream,
        Stream.retry(Schedule.exponential(Duration.seconds(1))),
        Stream.take(2),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      yield* $(TestClock.adjust(Duration.seconds(2)))
      yield* $(TestClock.adjust(Duration.seconds(1)))
      yield* $(Fiber.join(fiber))
      const result = yield* $(Ref.get(times))
      assert.deepStrictEqual(Array.from(result), [4, 3, 3, 1, 0])
    }))
})
