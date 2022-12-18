import * as OpCodes from "@effect/stream/internal/opCodes/haltStrategy"
import type * as HaltStrategy from "@effect/stream/Stream/HaltStrategy"

/** @internal */
export const Left: HaltStrategy.HaltStrategy = {
  op: OpCodes.OP_LEFT
}

/** @internal */
export const Right: HaltStrategy.HaltStrategy = {
  op: OpCodes.OP_RIGHT
}

/** @internal */
export const Both: HaltStrategy.HaltStrategy = {
  op: OpCodes.OP_BOTH
}

/** @internal */
export const Either: HaltStrategy.HaltStrategy = {
  op: OpCodes.OP_EITHER
}

/** @internal */
export const isLeft = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Left => self.op === OpCodes.OP_LEFT

/** @internal */
export const isRight = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Right => self.op === OpCodes.OP_RIGHT

/** @internal */
export const isBoth = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Both => self.op === OpCodes.OP_BOTH

/** @internal */
export const isEither = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Either => self.op === OpCodes.OP_EITHER

/** @internal */
export const match = <Z>(
  onLeft: () => Z,
  onRight: () => Z,
  onBoth: () => Z,
  onEither: () => Z
) => {
  return (self: HaltStrategy.HaltStrategy): Z => {
    switch (self.op) {
      case OpCodes.OP_LEFT: {
        return onLeft()
      }
      case OpCodes.OP_RIGHT: {
        return onRight()
      }
      case OpCodes.OP_BOTH: {
        return onBoth()
      }
      case OpCodes.OP_EITHER: {
        return onEither()
      }
    }
  }
}
