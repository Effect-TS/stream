import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Channel from "@effect/stream/Channel"

const program = Channel.flatMap(
  Channel.succeed(0),
  (n) => Channel.fail(`n: ${n}`)
)

const main = pipe(
  Channel.runDrain(program),
  Effect.catchAllCause(Effect.logError)
)

Effect.runFork(main)
