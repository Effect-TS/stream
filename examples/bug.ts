import * as Effect from "@effect/io/Effect"
import * as Channel from "@effect/stream/Channel"
import { pipe } from "@fp-ts/core/Function"

const program = pipe(
  Channel.ensuring(Channel.ensuring(Channel.unit(), Effect.die("ok")), Effect.unit()),
  Channel.runDrain,
  Effect.map((x) => console.log("HMMM", x)),
  Effect.catchAllCause(Effect.logErrorCause)
)

Effect.runFork(program)
