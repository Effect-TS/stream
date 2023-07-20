import { constTrue, pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Stream", () => {
  it.effect("distributedWithDynamic - ensures no race between subscription and stream end", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.empty,
        Stream.distributedWithDynamic(1, () => Effect.succeed(constTrue)),
        Effect.flatMap((add) => {
          const subscribe = pipe(
            add,
            Effect.map(([_, queue]) =>
              pipe(
                Stream.fromQueue(queue),
                Stream.filterMapWhile(Exit.match({
                  onFailure: Option.none,
                  onSuccess: Option.some
                }))
              )
            ),
            Stream.unwrap
          )
          return pipe(
            Deferred.make<never, void>(),
            Effect.flatMap((onEnd) =>
              pipe(
                subscribe,
                Stream.ensuring(Deferred.succeed<never, void>(onEnd, void 0)),
                Stream.runDrain,
                Effect.fork,
                Effect.zipRight(Deferred.await(onEnd)),
                Effect.zipRight(Stream.runDrain(subscribe))
              )
            )
          )
        }),
        Effect.scoped
      ))
      assert.isUndefined(result)
    }))
})
