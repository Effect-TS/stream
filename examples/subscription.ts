import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as Chunk from "@fp-ts/data/Chunk"
import { pipe } from "@fp-ts/data/Function"

import * as Fiber from "@effect/io/Fiber"
import * as SubscriptionRef from "@effect/stream/SubscriptionRef"
import * as Equal from "@fp-ts/data/Equal"
import * as Number from "@fp-ts/data/Number"

const program = Effect.gen(function*($) {
  console.log("START")
  const subscriber = (subscriptionRef: SubscriptionRef.SubscriptionRef<number>) =>
    pipe(
      Effect.log("STARTED"),
      Effect.flatMap(() =>
        pipe(
          subscriptionRef.changes,
          Stream.take(20),
          Stream.runCollect
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

Effect.unsafeRunPromiseExit(program).then((exit) => {
  console.log(exit)
})
