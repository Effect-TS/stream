import * as Effect from "@effect/io/Effect"
import * as Logger from "@effect/io/Logger"
import * as LogLevel from "@effect/io/Logger/Level"
import * as Channel from "@effect/stream/Channel"
import { pipe } from "@fp-ts/data/Function"

const channel = pipe(
  Channel.writeAll(1, 2, 3),
  Channel.concatMap((i) => Channel.writeAll(i, i))
)

const program = pipe(
  Channel.runCollect(channel),
  Effect.provideLayer(Logger.console(LogLevel.Debug))
)

Effect.unsafeFork(program)
