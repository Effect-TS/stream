/**
 * @since 1.0.0
 */
import * as internal from "@effect/stream/internal/channel/childExecutorDecision"
import type * as OpCodes from "@effect/stream/internal/opCodes/childExecutorDecision"

/**
 * @since 1.0.0
 * @category symbols
 */
export const ChildExecutorDecisionTypeId: unique symbol = internal.ChildExecutorDecisionTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type ChildExecutorDecisionTypeId = typeof ChildExecutorDecisionTypeId

/**
 * @since 1.0.0
 * @category models
 */
export type ChildExecutorDecision = Continue | Close | Yield

/**
 * @since 1.0.0
 */
export declare namespace ChildExecutorDecision {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Proto {
    readonly [ChildExecutorDecisionTypeId]: ChildExecutorDecisionTypeId
  }
}

/**
 * Continue executing the current substream
 *
 * @since 1.0.0
 * @category models
 */
export interface Continue extends ChildExecutorDecision.Proto {
  readonly op: OpCodes.OP_CONTINUE
}

/**
 * Close the current substream with a given value and pass execution to the
 * next substream
 *
 * @since 1.0.0
 * @category models
 */
export interface Close extends ChildExecutorDecision.Proto {
  readonly op: OpCodes.OP_CLOSE
  readonly value: unknown
}

/**
 * Pass execution to the next substream. This either pulls a new element
 * from upstream, or yields to an already created active substream.
 *
 * @since 1.0.0
 * @category models
 */
export interface Yield extends ChildExecutorDecision.Proto {
  readonly op: OpCodes.OP_YIELD
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const Continue: ChildExecutorDecision = internal.Continue

/**
 * @since 1.0.0
 * @category constructors
 */
export const Close: (value: unknown) => ChildExecutorDecision = internal.Close

/**
 * @since 1.0.0
 * @category constructors
 */
export const Yield: ChildExecutorDecision = internal.Yield

/**
 * Returns `true` if the specified value is a `ChildExecutorDecision`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isChildExecutorDecision: (u: unknown) => u is ChildExecutorDecision = internal.isChildExecutorDecision

/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Continue`,
 * `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isContinue: (self: ChildExecutorDecision) => self is Continue = internal.isContinue

/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Close`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isClose: (self: ChildExecutorDecision) => self is Close = internal.isClose

/**
 * Returns `true` if the specified `ChildExecutorDecision` is a `Yield`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isYield: (self: ChildExecutorDecision) => self is Yield = internal.isYield

/**
 * Folds over a `ChildExecutorDecision` to produce a value of type `A`.
 *
 * @since 1.0.0
 * @category folding
 */
export const match: <A>(
  onContinue: () => A,
  onClose: (value: unknown) => A,
  onYield: () => A
) => (self: ChildExecutorDecision) => A = internal.match
