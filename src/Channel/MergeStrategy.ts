/**
 * @since 1.0.0
 */
import * as internal from "@effect/stream/internal/channel/mergeStrategy"
import type * as OpCodes from "@effect/stream/internal/opCodes/mergeStrategy"

/**
 * @since 1.0.0
 * @category symbols
 */
export const MergeStrategyTypeId: unique symbol = internal.MergeStrategyTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type MergeStrategyTypeId = typeof MergeStrategyTypeId

/**
 * @since 1.0.0
 * @category models
 */
export type MergeStrategy = BackPressure | BufferSliding

/**
 * @since 1.0.0
 */
export declare namespace MergeStrategy {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Proto {
    readonly [MergeStrategyTypeId]: MergeStrategyTypeId
  }
}

/**
 * @since 1.0.0
 * @category models
 */
export interface BackPressure extends MergeStrategy.Proto {
  readonly op: OpCodes.OP_BACK_PRESSURE
}

/**
 * @since 1.0.0
 * @category models
 */
export interface BufferSliding extends MergeStrategy.Proto {
  readonly op: OpCodes.OP_BUFFER_SLIDING
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const BackPressure: MergeStrategy = internal.BackPressure

/**
 * @since 1.0.0
 * @category constructors
 */
export const BufferSliding: MergeStrategy = internal.BufferSliding

/**
 * Returns `true` if the specified value is a `MergeStrategy`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isMergeStrategy: (u: unknown) => u is MergeStrategy = internal.isMergeStrategy

/**
 * Returns `true` if the specified `MergeStrategy` is a `BackPressure`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isBackPressure: (self: MergeStrategy) => self is BackPressure = internal.isBackPressure

/**
 * Returns `true` if the specified `MergeStrategy` is a `BufferSliding`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isBufferSliding: (self: MergeStrategy) => self is BufferSliding = internal.isBufferSliding

/**
 * Folds an `MergeStrategy` into a value of type `A`.
 *
 * @since 1.0.0
 * @category folding
 */
export const match: <A>(
  onBackPressure: () => A,
  onBufferSliding: () => A
) => (self: MergeStrategy) => A = internal.match
