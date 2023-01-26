import * as Cause from "@effect/io/Cause"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Ref from "@effect/io/Ref"
import * as Channel from "@effect/stream/Channel"
import * as MergeDecision from "@effect/stream/Channel/MergeDecision"
import * as it from "@effect/stream/test/utils/extend"
import { constTrue, pipe } from "@fp-ts/core/Function"
import * as Option from "@fp-ts/core/Option"
import { assert, describe } from "vitest"

describe.concurrent("Channel", () => {
  it.effect("mergeWith - simple merge", () =>
    Effect.gen(function*($) {
      const [chunk, value] = yield* $(
        pipe(
          Channel.writeAll(1, 2, 3),
          Channel.mergeWith(
            Channel.writeAll(4, 5, 6),
            (leftDone) => MergeDecision.AwaitConst(Effect.done(leftDone)),
            (rightDone) => MergeDecision.AwaitConst(Effect.done(rightDone))
          ),
          Channel.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(chunk), [1, 2, 3, 4, 5, 6])
      assert.isUndefined(value)
    }))

  it.effect("mergeWith - merge with different types", () =>
    Effect.gen(function*($) {
      const left = pipe(
        Channel.write(1),
        Channel.zipRight(
          pipe(
            Effect.attempt(() => "whatever"),
            Effect.refineOrDie((e) =>
              Cause.isRuntimeException(e) ?
                Option.some(e) :
                Option.none()
            ),
            Channel.fromEffect
          )
        )
      )
      const right = pipe(
        Channel.write(2),
        Channel.zipRight(
          pipe(
            Effect.attempt(constTrue),
            Effect.refineOrDie((e) =>
              Cause.isIllegalArgumentException(e) ?
                Option.some(e) :
                Option.none()
            ),
            Channel.fromEffect
          )
        )
      )
      const [chunk, value] = yield* $(
        pipe(
          left,
          Channel.mergeWith(
            right,
            (leftDone) => MergeDecision.Await((rightDone) => Effect.done(pipe(leftDone, Exit.zip(rightDone)))),
            (rightDone) => MergeDecision.Await((leftDone) => Effect.done(pipe(leftDone, Exit.zip(rightDone))))
          ),
          Channel.runCollect
        )
      )
      assert.deepStrictEqual(Array.from(chunk), [1, 2])
      assert.deepStrictEqual(value, ["whatever", true])
    }))

  it.effect("mergeWith - handles polymorphic failures", () =>
    Effect.gen(function*($) {
      const left = pipe(
        Channel.write(1),
        Channel.zipRight(pipe(Channel.fail("boom"), Channel.as(true)))
      )
      const right = pipe(
        Channel.write(2),
        Channel.zipRight(pipe(Channel.fail(true), Channel.as(true)))
      )
      const result = yield* $(pipe(
        left,
        Channel.mergeWith(
          right,
          (leftDone) =>
            MergeDecision.Await((rightDone) =>
              pipe(
                Effect.done(leftDone),
                Effect.flip,
                Effect.zip(pipe(Effect.done(rightDone), Effect.flip)),
                Effect.flip
              )
            ),
          (rightDone) =>
            MergeDecision.Await((leftDone) =>
              pipe(
                Effect.done(leftDone),
                Effect.flip,
                Effect.zip(pipe(Effect.done(rightDone), Effect.flip)),
                Effect.flip
              )
            )
        ),
        Channel.runDrain,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail(["boom", true] as const))
    }))

  it.effect("mergeWith - interrupts losing side", () =>
    Effect.gen(function*($) {
      const latch = yield* $(Deferred.make<never, void>())
      const interrupted = yield* $(Ref.make(false))
      const left = pipe(
        Channel.write(1),
        Channel.zipRight(
          pipe(
            Deferred.succeed<never, void>(latch, void 0),
            Effect.zipRight(Effect.never()),
            Effect.onInterrupt(() => Ref.set(interrupted, true)),
            Channel.fromEffect
          )
        )
      )
      const right = pipe(
        Channel.write(2),
        Channel.zipRight(Channel.fromEffect(Deferred.await(latch)))
      )
      const merged = pipe(
        left,
        Channel.mergeWith(
          right,
          (leftDone) => MergeDecision.Done(Effect.done(leftDone)),
          (_rightDone) =>
            MergeDecision.Done(pipe(
              Ref.get(interrupted),
              Effect.flatMap((isInterrupted) => isInterrupted ? Effect.unit() : Effect.fail(void 0))
            ))
        )
      )
      const result = yield* $(Effect.exit(Channel.runDrain(merged)))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.succeed(void 0))
    }))
})
