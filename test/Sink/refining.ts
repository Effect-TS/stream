import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("refineOrDie", () =>
    Effect.gen(function*($) {
      const exception = Cause.RuntimeException()
      const refinedTo = "refined"
      const sink = pipe(
        Sink.fail(exception),
        Sink.refineOrDie((error) =>
          Cause.isRuntimeException(error) ?
            Option.some(refinedTo) :
            Option.none()
        )
      )
      const result = yield* $(Stream.make(1, 2, 3), Stream.run(sink), Effect.exit)
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail(refinedTo))
    }))

  it.effect("refineOrDieWith - refines", () =>
    Effect.gen(function*($) {
      const exception = Cause.RuntimeException()
      const refinedTo = "refined"
      const sink = pipe(
        Sink.fail(exception),
        Sink.refineOrDieWith((error) =>
          Cause.isRuntimeException(error) ?
            Option.some(refinedTo) :
            Option.none(), (error) => error.message)
      )
      const result = yield* $(Stream.make(1, 2, 3), Stream.run(sink), Effect.exit)
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail(refinedTo))
    }))

  it.effect("refineOrDieWith - dies", () =>
    Effect.gen(function*($) {
      const exception = Cause.RuntimeException()
      const refinedTo = "refined"
      const sink = pipe(
        Sink.fail(exception),
        Sink.refineOrDieWith((error) =>
          Cause.isIllegalArgumentException(error) ?
            Option.some(refinedTo) :
            Option.none(), (error) => error.message)
      )
      const result = yield* $(Stream.make(1, 2, 3), Stream.run(sink), Effect.exit)
      assert.deepStrictEqual(Exit.unannotate(result), Exit.die(void 0))
    }))
})
