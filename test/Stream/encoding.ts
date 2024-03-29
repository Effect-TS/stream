import * as Chunk from "@effect/data/Chunk"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"

describe.concurrent("Stream", () => {
  it.effect("decodeText/encodeText round trip", () =>
    Effect.gen(function*(_) {
      const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i"]
      const encoded = yield* _(
        Stream.fromIterable(items),
        Stream.encodeText,
        Stream.runCollect
      )
      expect(encoded.length).toEqual(9)
      const decoded = yield* _(
        Stream.fromChunk(encoded),
        Stream.decodeText(),
        Stream.runCollect
      )
      expect(Chunk.toReadonlyArray(decoded)).toEqual(items)
    }))
})
