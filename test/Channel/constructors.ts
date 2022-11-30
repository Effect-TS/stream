import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import * as Chunk from "@fp-ts/data/Chunk"
import { assert, describe } from "vitest"

describe.concurrent("Channel", () => {
  it.effect("succeed", () =>
    Effect.gen(function*($) {
      const [chunk, value] = yield* $(Channel.runCollect(Channel.succeed(1)))
      assert.isTrue(Chunk.isEmpty(chunk))
      assert.strictEqual(value, 1)
    }))

  it.effect("fail", () =>
    Effect.gen(function*($) {
      const result = yield* $(Effect.exit(Channel.runCollect(Channel.fail("uh oh"))))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("uh oh"))
    }))
})
