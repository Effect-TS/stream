import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as FiberId from "@effect/io/Fiber/Id"
import * as Ref from "@effect/io/Ref"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Channel", () => {
  it.it("acquireUseReleaseOut - acquire is executed uninterruptibly", async () => {
    const latch = Deferred.unsafeMake<never, void>(FiberId.none)
    const program = Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const acquire = pipe(ref, Ref.update((n) => n + 1), Effect.zipRight(Effect.yieldNow()))
      const release = pipe(ref, Ref.update((n) => n - 1))
      yield* $(
        pipe(
          Channel.acquireReleaseOut(acquire, () => release),
          Channel.as(Channel.fromEffect(Deferred.await(latch))),
          Channel.runDrain,
          Effect.fork,
          Effect.flatMap((fiber) => pipe(Effect.yieldNow(), Effect.zipRight(Fiber.interrupt(fiber)))),
          Effect.repeatN(10_000)
        )
      )
      return yield* $(Ref.get(ref))
    })
    const result = await Effect.unsafeRunPromise(program)
    await Effect.unsafeRunPromise(pipe(latch, Deferred.succeed<void>(void 0)))
    assert.strictEqual(result, 0)
  }, 20_000)

  it.it("scoped closes the scope", async () => {
    const latch = Deferred.unsafeMake<never, void>(FiberId.none)
    const program = Effect.gen(function*($) {
      const ref = yield* $(Ref.make(0))
      const acquire = pipe(ref, Ref.update((n) => n + 1), Effect.zipRight(Effect.yieldNow()))
      const release = pipe(ref, Ref.update((n) => n - 1))
      const scoped = Effect.acquireRelease(acquire, () => release)
      yield* $(pipe(
        Channel.unwrapScoped(pipe(scoped, Effect.as(Channel.fromEffect(Deferred.await(latch))))),
        Channel.runDrain,
        Effect.fork,
        Effect.flatMap((fiber) => pipe(Effect.yieldNow(), Effect.zipRight(Fiber.interrupt(fiber)))),
        Effect.repeatN(10_000)
      ))
      return yield* $(Ref.get(ref))
    })
    const result = await Effect.unsafeRunPromise(program)
    await Effect.unsafeRunPromise(pipe(latch, Deferred.succeed<void>(void 0)))
    assert.strictEqual(result, 0)
  }, 20_000)
})
