import type * as Chunk from "@fp-ts/data/Chunk"

/** @internal */
export type ZipAllState<A, A2> = DrainLeft | DrainRight | PullBoth | PullLeft<A2> | PullRight<A>

/** @internal */
export const OP_DRAIN_LEFT = 0 as const

/** @internal */
export type OP_DRAIN_LEFT = typeof OP_DRAIN_LEFT

/** @internal */
export const OP_DRAIN_RIGHT = 1 as const

/** @internal */
export type OP_DRAIN_RIGHT = typeof OP_DRAIN_RIGHT

/** @internal */
export const OP_PULL_BOTH = 2 as const

/** @internal */
export type OP_PULL_BOTH = typeof OP_PULL_BOTH

/** @internal */
export const OP_PULL_LEFT = 3 as const

/** @internal */
export type OP_PULL_LEFT = typeof OP_PULL_LEFT

/** @internal */
export const OP_PULL_RIGHT = 4 as const

/** @internal */
export type OP_PULL_RIGHT = typeof OP_PULL_RIGHT

/** @internal */
export interface DrainLeft {
  readonly op: OP_DRAIN_LEFT
}

/** @internal */
export interface DrainRight {
  readonly op: OP_DRAIN_RIGHT
}

/** @internal */
export interface PullBoth {
  readonly op: OP_PULL_BOTH
}

/** @internal */
export interface PullLeft<A> {
  readonly op: OP_PULL_LEFT
  readonly rightChunk: Chunk.Chunk<A>
}

/** @internal */
export interface PullRight<A> {
  readonly op: OP_PULL_RIGHT
  readonly leftChunk: Chunk.Chunk<A>
}

/** @internal */
export const DrainLeft: ZipAllState<never, never> = {
  op: OP_DRAIN_LEFT
}

/** @internal */
export const DrainRight: ZipAllState<never, never> = {
  op: OP_DRAIN_RIGHT
}

/** @internal */
export const PullBoth: ZipAllState<never, never> = {
  op: OP_PULL_BOTH
}

/** @internal */
export const PullLeft = <A>(rightChunk: Chunk.Chunk<A>): ZipAllState<never, A> => ({
  op: OP_PULL_LEFT,
  rightChunk
})

/** @internal */
export const PullRight = <A>(leftChunk: Chunk.Chunk<A>): ZipAllState<A, never> => ({
  op: OP_PULL_RIGHT,
  leftChunk
})
