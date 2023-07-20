import * as Duration from "@effect/data/Duration"
import { identity, pipe } from "@effect/data/Function"
import * as Clock from "@effect/io/Clock"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as TestClock from "@effect/io/internal/testing/testClock"
import * as Schedule from "@effect/io/Schedule"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("schedule", () =>
    Effect.gen(function*($) {
      const start = yield* $(Clock.currentTimeMillis)
      const fiber = yield* $(pipe(
        Stream.range(1, 9),
        Stream.schedule<never, number>(Schedule.fixed(Duration.millis(100))),
        Stream.mapEffect((n) =>
          pipe(
            Clock.currentTimeMillis,
            Effect.map((now) => [n, now - start] as const)
          )
        ),
        Stream.runCollect,
        Effect.fork
      ))
      yield* $(TestClock.adjust(Duration.millis(800)))
      const result = yield* $(Fiber.join(fiber))
      assert.deepStrictEqual(Array.from(result), [
        [1, 100],
        [2, 200],
        [3, 300],
        [4, 400],
        [5, 500],
        [6, 600],
        [7, 700],
        [8, 800]
      ])
    }))

  it.effect("scheduleWith", () =>
    Effect.gen(function*($) {
      const schedule = pipe(
        Schedule.recurs(2),
        Schedule.zipRight(Schedule.fromFunction<string, string>(() => "Done"))
      )
      const result = yield* $(pipe(
        Stream.make("A", "B", "C", "A", "B", "C"),
        Stream.scheduleWith(schedule, (s) => s.toLowerCase(), identity),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["a", "b", "c", "Done", "a", "b", "c", "Done"])
    }))
})
