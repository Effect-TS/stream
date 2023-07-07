import * as Chunk from "@effect/data/Chunk"
import * as Equal from "@effect/data/Equal"
import { pipe } from "@effect/data/Function"
import * as Number from "@effect/data/Number"
import * as Effect from "@effect/io/Effect"
import * as Fiber from "@effect/io/Fiber"
import * as Stream from "@effect/stream/Stream"
import * as SubscriptionRef from "@effect/stream/SubscriptionRef"

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
  const result = yield* $(Effect.all(
    Array.from({ length: 2 }, () => subscriber(subscriptionRef)),
    { concurrency: 2 }
  ))
  yield* $(Fiber.interrupt(fiber))
  const isSorted = result.every((chunk) =>
    Equal.equals(
      chunk,
      Chunk.sort(chunk, Number.Order)
    )
  )
  return isSorted
})

Effect.runPromiseExit(program).then((exit) => {
  console.log(exit)
})
