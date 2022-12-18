import type * as Cause from "@effect/io/Cause"
import type * as SinkEndReason from "@effect/stream/internal/stream/sinkEndReason"
import type * as Chunk from "@fp-ts/data/Chunk"

/** @internal */
export type HandoffSignal<E, A> = Emit<A> | Halt<E> | End

/** @internal */
export const OP_EMIT = 0 as const

/** @internal */
export type OP_EMIT = typeof OP_EMIT

/** @internal */
export const OP_HALT = 1 as const

/** @internal */
export type OP_HALT = typeof OP_HALT

/** @internal */
export const OP_END = 2 as const

/** @internal */
export type OP_END = typeof OP_END

export interface Emit<A> {
  readonly op: OP_EMIT
  readonly elements: Chunk.Chunk<A>
}

/** @internal */
export interface Halt<E> {
  readonly op: OP_HALT
  readonly cause: Cause.Cause<E>
}

/** @internal */
export interface End {
  readonly op: OP_END
  readonly reason: SinkEndReason.SinkEndReason
}

/** @internal */
export const emit = <A>(elements: Chunk.Chunk<A>): HandoffSignal<never, A> => ({
  op: OP_EMIT,
  elements
})

/** @internal */
export const halt = <E>(cause: Cause.Cause<E>): HandoffSignal<E, never> => ({
  op: OP_HALT,
  cause
})

/** @internal */
export const end = (reason: SinkEndReason.SinkEndReason): HandoffSignal<never, never> => ({
  op: OP_END,
  reason
})
