import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/core/Function"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("unwrapScoped - happy path", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const resource = Effect.acquireRelease(Effect.succeed(100), () => Ref.set(ref, true))
      const sink = pipe(
        resource,
        Effect.map((n) =>
          pipe(
            Sink.count(),
            Sink.mapEffect((count) =>
              pipe(
                Ref.get(ref),
                Effect.map((closed) => [count + n, closed] as const)
              )
            )
          )
        ),
        Sink.unwrapScoped
      )
      const [result, state] = yield* $(pipe(Stream.make(1, 2, 3), Stream.run(sink)))
      const finalState = yield* $(Ref.get(ref))
      assert.strictEqual(result, 103)
      assert.isFalse(state)
      assert.isTrue(finalState)
    }))

  it.effect("unwrapScoped - error", () =>
    Effect.gen(function*($) {
      const ref = yield* $(Ref.make(false))
      const resource = Effect.acquireRelease(Effect.succeed(100), () => Ref.set(ref, true))
      const sink = pipe(resource, Effect.as(Sink.succeed("ok")), Sink.unwrapScoped)
      const result = yield* $(pipe(Stream.fail("fail"), Stream.run(sink)))
      const finalState = yield* $(Ref.get(ref))
      assert.strictEqual(result, "ok")
      assert.isTrue(finalState)
    }))
})
