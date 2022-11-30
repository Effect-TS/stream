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
  op: {
    value: OpCodes.OP_BACK_PRESSURE,
    enumerable: true
  }
})

/** @internal */
export const BufferSliding: MergeStrategy.MergeStrategy = Object.create(proto, {
  op: {
    value: OpCodes.OP_BUFFER_SLIDING,
    enumerable: true
  }
})

/** @internal */
export const isMergeStrategy = (u: unknown): u is MergeStrategy.MergeStrategy => {
  return typeof u === "object" && u != null && MergeStrategyTypeId in u
}

/** @internal */
export const isBackPressure = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BackPressure => {
  return self.op === OpCodes.OP_BACK_PRESSURE
}

/** @internal */
export const isBufferSliding = (self: MergeStrategy.MergeStrategy): self is MergeStrategy.BufferSliding => {
  return self.op === OpCodes.OP_BUFFER_SLIDING
}

/** @internal */
export const match = <A>(
  onBackPressure: () => A,
  onBufferSliding: () => A
) => {
  return (self: MergeStrategy.MergeStrategy): A => {
    switch (self.op) {
      case OpCodes.OP_BACK_PRESSURE: {
        return onBackPressure()
      }
      case OpCodes.OP_BUFFER_SLIDING: {
        return onBufferSliding()
      }
    }
  }
}
