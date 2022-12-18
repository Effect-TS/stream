import type * as Fiber from "@effect/io/Fiber"
import type * as HandoffSignal from "@effect/stream/internal/stream/handoffSignal"
import type * as Chunk from "@fp-ts/data/Chunk"

/** @internal */
export type DebounceState<E, A> = NotStarted | Previous<A> | Current<E, A>

/** @internal */
export const OP_NOT_STARTED = 0 as const

/** @internal */
export type OP_NOT_STARTED = typeof OP_NOT_STARTED

/** @internal */
export const OP_PREVIOUS = 1 as const

/** @internal */
export type OP_PREVIOUS = typeof OP_PREVIOUS

/** @internal */
export const OP_CURRENT = 2 as const

/** @internal */
export type OP_CURRENT = typeof OP_CURRENT

export interface NotStarted {
  readonly op: OP_NOT_STARTED
}

/** @internal */
export interface Previous<A> {
  readonly op: OP_PREVIOUS
  readonly fiber: Fiber.Fiber<never, Chunk.Chunk<A>>
}

/** @internal */
export interface Current<E, A> {
  readonly op: OP_CURRENT
  readonly fiber: Fiber.Fiber<E, HandoffSignal.HandoffSignal<E, A>>
}

/** @internal */
export const notStarted: DebounceState<never, never> = {
  op: OP_NOT_STARTED
}

/** @internal */
export const previous = <A>(fiber: Fiber.Fiber<never, Chunk.Chunk<A>>): DebounceState<never, A> => ({
  op: OP_PREVIOUS,
  fiber
})

/** @internal */
export const current = <E, A>(fiber: Fiber.Fiber<E, HandoffSignal.HandoffSignal<E, A>>): DebounceState<E, A> => ({
  op: OP_CURRENT,
  fiber
})
