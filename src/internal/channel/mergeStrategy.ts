import * as Debug from "@effect/io/Debug"
import type * as MergeStrategy from "@effect/stream/Channel/MergeStrategy"
import * as OpCodes from "@effect/stream/internal/opCodes/mergeStrategy"

/** @internal */
const MergeStrategySymbolKey = "@effect/stream/Channel/MergeStrategy"

/** @internal */
export const MergeStrategyTypeId: MergeStrategy.MergeStrategyTypeId = Symbol.for(
  MergeStrategySymbolKey
) as MergeStrategy.MergeStrategyTypeId

/** @internal */
const proto = {
  [MergeStrategyTypeId]: MergeStrategyTypeId
}

/** @internal */
export const BackPressure: MergeStrategy.MergeStrategy = Object.create(proto, {
  _tag: { value: OpCodes.OP_BACK_PRESSURE }
})

/** @internal */
export const BufferSliding: MergeStrategy.MergeStrategy = Object.create(proto, {
  _tag: { value: OpCodes.OP_BUFFER_SLIDING }
})

/** @internal */
export const isMergeStrategy = (u: unknown): u is MergeStrategy.MergeStrategy => {
  return typeof u === "object" && u != null && MergeStrategyTypeId in u
}

/** @internal */
export const isBackPressure = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BackPressure => {
  return self._tag === OpCodes.OP_BACK_PRESSURE
}

/** @internal */
export const isBufferSliding = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BufferSliding => {
  return self._tag === OpCodes.OP_BUFFER_SLIDING
}

/** @internal */
export const match = Debug.dual<
  <A>(
    self: MergeStrategy.MergeStrategy,
    onBackPressure: () => A,
    onBufferSliding: () => A
  ) => A,
  <A>(onBackPressure: () => A, onBufferSliding: () => A) => (self: MergeStrategy.MergeStrategy) => A
>(3, <A>(
  self: MergeStrategy.MergeStrategy,
  onBackPressure: () => A,
  onBufferSliding: () => A
): A => {
  switch (self._tag) {
    case OpCodes.OP_BACK_PRESSURE: {
      return onBackPressure()
    }
    case OpCodes.OP_BUFFER_SLIDING: {
      return onBufferSliding()
    }
  }
})
