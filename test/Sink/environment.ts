import * as Context from "@effect/data/Context"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Sink from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Sink", () => {
  it.effect("contextWithSink", () =>
    Effect.gen(function*($) {
      const tag = Context.Tag<string>()
      const sink = pipe(
        Sink.contextWithSink((env: Context.Context<string>) => Sink.succeed(pipe(env, Context.get(tag)))),
        Sink.provideContext(pipe(Context.empty(), Context.add(tag, "use this")))
      )
      const result = yield* $(Stream.make("ignore this"), Stream.run(sink))
      assert.strictEqual(result, "use this")
    }))
})
