import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Channel from "@effect/stream/Channel"

const program = pipe(
  Channel.ensuring(Channel.ensuring(Channel.unit(), Effect.die("ok")), Effect.unit),
  Channel.runDrain,
  Effect.map((x) => console.log("HMMM", x)),
  Effect.catchAllCause((cause) => Effect.logCause(cause, { level: "Error" }))
)

Effect.runFork(program)
