import * as Context from "@effect/data/Context"
import * as Either from "@effect/data/Either"
import * as Option from "@effect/data/Option"
import { unify } from "@effect/data/Unify"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import { nextInt } from "@effect/io/Random"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Channel.Foreign", () => {
  it.effect("Tag", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<number>()
      const result = yield* $(tag, Channel.run, Effect.provideService(tag, 10))
      assert.deepEqual(result, 10)
    }))

  it.effect("Unify", () =>
    Effect.gen(function*($) {
      const unifiedEffect = unify((yield* $(nextInt())) > 1 ? Effect.succeed(0) : Effect.fail(1))
      const unifiedExit = unify((yield* $(nextInt())) > 1 ? Exit.succeed(0) : Exit.fail(1))
      const unifiedEither = unify((yield* $(nextInt())) > 1 ? Either.right(0) : Either.left(1))
      const unifiedOption = unify((yield* $(nextInt())) > 1 ? Option.some(0) : Option.none())
      assert.deepEqual(yield* $(Channel.run(unifiedEffect)), 0)
      assert.deepEqual(yield* $(Channel.run(unifiedExit)), 0)
      assert.deepEqual(yield* $(Channel.run(unifiedEither)), 0)
      assert.deepEqual(yield* $(Channel.run(unifiedOption)), 0)
    }))
})
