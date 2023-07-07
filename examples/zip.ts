import * as Chunk from "@effect/data/Chunk"
import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as util from "node:util"

/** @internal */
const zipChunks = <A, B, C>(
  left: Chunk.Chunk<A>,
  right: Chunk.Chunk<B>,
  f: (a: A, b: B) => C
): readonly [Chunk.Chunk<C>, Either.Either<Chunk.Chunk<A>, Chunk.Chunk<B>>] => {
  if (left.length > right.length) {
    return [
      pipe(left, Chunk.take(right.length), Chunk.zipWith(right, f)),
      Either.left(pipe(left, Chunk.drop(right.length)))
    ] as const
  }
  return [
    pipe(left, Chunk.zipWith(pipe(right, Chunk.take(left.length)), f)),
    Either.right(pipe(right, Chunk.drop(left.length)))
  ] as const
}

const left = pipe(Chunk.make(-1, 0, 1), Chunk.drop(1))
// Chunk(0, 1)
const right = pipe(Chunk.make(1, 0, 0, 1), Chunk.drop(1))
// Chunk(0, 0, 1)

const [chunk, either] = zipChunks(left, right, (a, b) => [a, b])
// [Chunk([0, 0], [1, 0]), Right([1])]

console.log(util.inspect(Array.from(chunk), { depth: null, colors: true }))

console.log(
  util.inspect(
    Either.mapBoth(either, {
      onLeft: (chunk) => Array.from(chunk),
      onRight: (chunk) => Array.from(chunk)
    })
  ),
  { depth: null, colors: true }
)
