import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Fiber from "@effect/io/Fiber"
import * as Ref from "@effect/io/Ref"
import * as Schedule from "@effect/io/Schedule"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import * as Duration from "@fp-ts/data/Duration"
import * as Either from "@fp-ts/data/Either"
import { constVoid, identity, pipe } from "@fp-ts/data/Function"
import * as Option from "@fp-ts/data/Option"
import fc from "fast-check"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("forever", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      yield* $(pipe(
        Stream.make(1),
        Stream.forever,
        Stream.runForEachWhile(() =>
          pipe(
            ref,
            Ref.modify((sum) => [sum >= 9 ? false : true, sum + 1] as const)
          )
        )
      ))
      const result = yield* $(Ref.get(ref))
      assert.strictEqual(result, 10)
    }))

  it.effect("repeat", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.repeat(Schedule.recurs(4)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 1, 1, 1, 1])
    }))

  // TODO(Mike/Max): replace with TestClock after `@effect/test`
  it.effect("repeat - short circuits", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<number>()))
      const fiber = yield* $(pipe(
        Stream.fromEffect(pipe(ref, Ref.update(Chunk.prepend(1)))),
        Stream.repeat(Schedule.spaced(Duration.millis(5))),
        Stream.take(2),
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(Effect.sleep(Duration.millis(20)))
      yield* $(Fiber.join(fiber))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(Array.from(result), [1, 1])
    }))

  it.effect("repeat - does not swallow errors on a repetition", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const result = yield* $(pipe(
        Stream.fromEffect(pipe(
          ref,
          Ref.getAndUpdate((n) => n + 1),
          Effect.flatMap((n) => n <= 2 ? Effect.succeed(n) : Effect.fail("boom"))
        )),
        Stream.repeat(Schedule.recurs(3)),
        Stream.runDrain,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("repeatEither", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make(1),
        Stream.repeatEither(Schedule.recurs(4)),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [
        Either.right(1),
        Either.right(1),
        Either.left(0),
        Either.right(1),
        Either.left(1),
        Either.right(1),
        Either.left(2),
        Either.right(1),
        Either.left(3)
      ])
    }))

  it.effect("repeatEffectOption - emit elements", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.repeatEffectOption(Effect.succeed(1)),
        Stream.take(2),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 1])
    }))

  it.effect("repeatEffectOption - emit elements until pull fails with None", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const result = yield* $(pipe(
        Stream.repeatEffectOption(
          pipe(
            ref,
            Ref.updateAndGet((n) => n + 1),
            Effect.flatMap((n) =>
              n >= 5 ?
                Effect.fail(Option.none) :
                Effect.succeed(n)
            )
          )
        ),
        Stream.take(10),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 2, 3, 4])
    }))

  it.effect("repeatEffectOption - stops evaluating the effect once it fails with None", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      yield* $(pipe(
        Stream.repeatEffectOption(pipe(
          ref,
          Ref.updateAndGet((n) => n + 1),
          Effect.zipRight(Effect.fail(Option.none))
        )),
        Stream.toPull,
        Effect.flatMap((pull) =>
          pipe(
            Effect.ignore(pull),
            Effect.zipRight(Effect.ignore(pull))
          )
        ),
        Effect.scoped
      ))
      const result = yield* $(Ref.get(ref))
      assert.strictEqual(result, 1)
    }))

  // TODO(Mike/Max): after `@effect/test`
  // suite("repeatZIOWithSchedule")(
  //   test("succeed")(
  //     for {
  //       ref <- Ref.make[List[Int]](Nil)
  //       fiber <- ZStream
  //                  .repeatZIOWithSchedule(ref.update(1 :: _), Schedule.spaced(10.millis))
  //                  .take(2)
  //                  .runDrain
  //                  .fork
  //       _      <- TestClock.adjust(50.millis)
  //       _      <- fiber.join
  //       result <- ref.get
  //     } yield assert(result)(equalTo(List(1, 1)))
  //   ),

  it.it("repeatEffectWithSchedule - allow schedule to rely on effect value", () => {
    fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (length) => {
      const effect = Effect.gen(function*($) {
        const ref = yield* $(Ref.make(0))
        const effect = pipe(
          ref,
          Ref.getAndUpdate((n) => n + 1),
          Effect.filterOrFail((n) => n <= length + 1, constVoid)
        )
        const schedule = pipe(
          Schedule.identity<number>(),
          Schedule.whileInput((n) => n < length)
        )
        const stream = Stream.repeatEffectWithSchedule(effect, schedule)
        return yield* $(Stream.runCollect(stream))
      })
      const result = await Effect.unsafeRunPromise(effect)
      assert.deepStrictEqual(Array.from(result), Array.from(Chunk.range(0, length)))
    })
  })

  it.effect("repeatEffectWithSchedule - should perform repetitions in addition to the first execution (one repetition)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.repeatEffectWithSchedule(Effect.succeed(1), Schedule.once()),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1, 1])
    }))

  it.effect("repeatEffectWithSchedule - should perform repetitions in addition to the first execution (zero repetitions)", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.repeatEffectWithSchedule(Effect.succeed(1), Schedule.stop()),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [1])
    }))

  // TODO(Mike/Max): after `@effect/test`
  //   test("emits before delaying according to the schedule") {
  //     val interval = 1.second

  //     for {
  //       collected <- Ref.make(0)
  //       effect     = ZIO.unit
  //       schedule   = Schedule.spaced(interval)
  //       streamFiber <- ZStream
  //                        .repeatZIOWithSchedule(effect, schedule)
  //                        .tap(_ => collected.update(_ + 1))
  //                        .runDrain
  //                        .fork
  //       _                      <- TestClock.adjust(0.seconds)
  //       nrCollectedImmediately <- collected.get
  //       _                      <- TestClock.adjust(1.seconds)
  //       nrCollectedAfterDelay  <- collected.get
  //       _                      <- streamFiber.interrupt

  //     } yield assert(nrCollectedImmediately)(equalTo(1)) && assert(nrCollectedAfterDelay)(equalTo(2))
  //   }
  // ),

  // TODO(Mike/Max): repace with TestClock after `@effect/test`
  it.effect("repeatEither - short circuits", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(Chunk.empty<number>()))
      const fiber = yield* $(pipe(
        Stream.fromEffect(pipe(ref, Ref.update(Chunk.prepend(1)))),
        Stream.repeatEither(Schedule.spaced(Duration.millis(5))),
        Stream.take(3), // take one of the schedule outputs
        Stream.runDrain,
        Effect.fork
      ))
      yield* $(Effect.sleep(Duration.millis(20)))
      yield* $(Fiber.join(fiber))
      const result = yield* $(Ref.get(ref))
      assert.deepStrictEqual(Array.from(result), [1, 1])
    }))

  it.effect("repeatElements - simple", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make("A", "B", "C"),
        Stream.repeatElements(Schedule.once()),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["A", "A", "B", "B", "C", "C"])
    }))

  it.effect("repeatElements - short circuits in a schedule", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make("A", "B", "C"),
        Stream.repeatElements(Schedule.once()),
        Stream.take(4),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["A", "A", "B", "B"])
    }))

  it.effect("repeatElements - short circuits after schedule", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.make("A", "B", "C"),
        Stream.repeatElements(Schedule.once()),
        Stream.take(3),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["A", "A", "B"])
    }))

  it.effect("repeatElementsWith", () =>
    Effect.gen(function*($) {
      const schedule = pipe(
        Schedule.recurs(0),
        Schedule.zipRight(Schedule.fromFunction(() => 123))
      )
      const result = yield* $(pipe(
        Stream.make("A", "B", "C"),
        Stream.repeatElementsWith(schedule, identity, String),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["A", "123", "B", "123", "C", "123"])
    }))

  it.effect("repeatElementsEither", () =>
    Effect.gen(function*($) {
      const schedule = pipe(
        Schedule.recurs(0),
        Schedule.zipRight(Schedule.fromFunction(() => 123))
      )
      const result = yield* $(pipe(
        Stream.make("A", "B", "C"),
        Stream.repeatElementsEither(schedule),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [
        Either.right("A"),
        Either.left(123),
        Either.right("B"),
        Either.left(123),
        Either.right("C"),
        Either.left(123)
      ])
    }))
})
