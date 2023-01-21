import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Context from "@fp-ts/data/Context"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("contextWithSink", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<string>()
      const sink = pipe(
        Sink.contextWithSink((env: Context.Context<string>) => Sink.succeed(pipe(env, Context.get(tag)))),
        Sink.provideContext(pipe(Context.empty(), Context.add(tag)("use this")))
      )
      const result = yield* $(pipe(Stream.make("ignore this"), Stream.run(sink)))
      assert.strictEqual(result, "use this")
    }))
})
