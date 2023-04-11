import * as Context from "@effect/data/Context"
import * as Either from "@effect/data/Either"
import * as Option from "@effect/data/Option"
import { unify } from "@effect/data/Unify"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import { nextInt } from "@effect/io/Random"
import type * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

const runSink = <R, E, A>(sink: Sink.Sink<R, E, unknown, unknown, A>) => Stream.run(Effect.unit(), sink)

describe.concurrent("Channel.Foreign", () => {
  it.effect("Tag", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(tag, runSink, Effect.provideService(tag, 10))
      assert.deepEqual(result, 10)
    }))

  it.effect("Unify", () =>
    Effect.gen(function*($) {
      const unifiedEffect = unify((yield* $(nextInt())) > 1 ? Effect.succeed(0) : Effect.fail(1))
      const unifiedExit = unify((yield* $(nextInt())) > 1 ? Exit.succeed(0) : Exit.fail(1))
      const unifiedEither = unify((yield* $(nextInt())) > 1 ? Either.right(0) : Either.left(1))
      const unifiedOption = unify((yield* $(nextInt())) > 1 ? Option.some(0) : Option.none())
      assert.deepEqual(yield* $(runSink(unifiedEffect)), 0)
      assert.deepEqual(yield* $(runSink(unifiedExit)), 0)
      assert.deepEqual(yield* $(runSink(unifiedEither)), 0)
      assert.deepEqual(yield* $(runSink(unifiedOption)), 0)
    }))
})
