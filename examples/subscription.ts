import * as Chunk from "@effect/data/Chunk"
import * as Equal from "@effect/data/Equal"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Stream from "@effect/stream/Stream"
import * as SubscriptionRef from "@effect/stream/SubscriptionRef"
import { pipe } from "@fp-ts/core/Function"
import * as Number from "@fp-ts/core/Number"

const program = Effect.gen(function*($) {
  console.log("START")
  const subscriber = (subscriptionRef: SubscriptionRef.SubscriptionRef<number>) =>
    pipe(
      Effect.log("STARTED"),
      Effect.flatMap(() =>
        Stream.runCollect(
          Stream.take(subscriptionRef.changes, 20)
        )
      ),
      Effect.tap(() => Effect.log("STOPPED"))
    )
  const subscriptionRef = yield* $(SubscriptionRef.make(0))
  const fiber = yield* $(pipe(
    SubscriptionRef.update(subscriptionRef, (n) => n + 1),
    Effect.forever,
    Effect.fork
  ))
  const result = yield* $(
    Effect.collectAllPar(
      Array.from({ length: 2 }, () => subscriber(subscriptionRef))
    )
  )
  yield* $(Fiber.interrupt(fiber))
  const isSorted = pipe(
    result,
    Chunk.every((chunk) => Equal.equals(chunk, pipe(chunk, Chunk.sort(Number.Order))))
  )
  return isSorted
})

Effect.runPromiseExit(program).then((exit) => {
  console.log(exit)
})
