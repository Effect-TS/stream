import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Ref from "@effect/io/Ref"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import * as Either from "@fp-ts/data/Either"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Channel", () => {
  it.effect("interruptWhen - interrupts the current element", () =>
    Effect.gen(function*($) {
      const interrupted = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      const started = yield* $(Deferred.make<never, void>())
      const channel = pipe(
        started,
        Deferred.succeed<void>(void 0),
        Effect.zipRight(Deferred.await(latch)),
        Effect.onInterrupt(() => pipe(interrupted, Ref.set(true))),
        Channel.fromEffect,
        Channel.interruptWhen(Deferred.await(halt))
      )
      const fiber = yield* $(Effect.fork(Channel.runDrain(channel)))
      yield* $(
        pipe(
          Deferred.await(started),
          Effect.zipRight(pipe(halt, Deferred.succeed<void>(void 0)))
        )
      )
      yield* $(Fiber.await(fiber))
      const result = yield* $(Ref.get(interrupted))
      assert.isTrue(result)
    }))

  it.effect("interruptWhen - propagates errors", () =>
    Effect.gen(function*($) {
      const deferred = yield* $(Deferred.make<string, never>())
      const channel = pipe(
        Channel.fromEffect(Effect.never()),
        Channel.interruptWhen(Deferred.await(deferred))
      )
      yield* $(pipe(deferred, Deferred.fail("fail")))
      const result = yield* $(pipe(Channel.runDrain(channel), Effect.either))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))

  it.effect("interruptWhenDeferred - interrupts the current element", () =>
    Effect.gen(function*($) {
      const interrupted = yield* $(Ref.make(false))
      const latch = yield* $(Deferred.make<never, void>())
      const halt = yield* $(Deferred.make<never, void>())
      const started = yield* $(Deferred.make<never, void>())
      const channel = pipe(
        started,
        Deferred.succeed<void>(void 0),
        Effect.zipRight(Deferred.await(latch)),
        Effect.onInterrupt(() => pipe(interrupted, Ref.set(true))),
        Channel.fromEffect,
        Channel.interruptWhenDeferred(halt)
      )
      const fiber = yield* $(Effect.fork(Channel.runDrain(channel)))
      yield* $(
        pipe(
          Deferred.await(started),
          Effect.zipRight(pipe(halt, Deferred.succeed<void>(void 0)))
        )
      )
      yield* $(Fiber.await(fiber))
      const result = yield* $(Ref.get(interrupted))
      assert.isTrue(result)
    }))

  it.effect("interruptWhenDeferred - propagates errors", () =>
    Effect.gen(function*($) {
      const deferred = yield* $(Deferred.make<string, never>())
      const channel = pipe(
        Channel.fromEffect(Effect.never()),
        Channel.interruptWhenDeferred(deferred)
      )
      yield* $(pipe(deferred, Deferred.fail("fail")))
      const result = yield* $(pipe(Channel.runDrain(channel), Effect.either))
      assert.deepStrictEqual(result, Either.left("fail"))
    }))
})
