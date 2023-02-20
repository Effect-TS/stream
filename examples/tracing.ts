import * as Effect from "@effect/io/Effect"
import * as Channel from "@effect/stream/Channel"

const program = Channel.flatMap(
  Channel.succeed(0),
  (n) => Channel.fail(`n: ${n}`)
)

const main = Effect.catchAllCause(Channel.runDrain(program), Effect.logErrorCause)

Effect.runFork(main)
