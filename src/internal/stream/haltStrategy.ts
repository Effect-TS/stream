import * as Debug from "@effect/io/Debug"
import * as OpCodes from "@effect/stream/internal/opCodes/haltStrategy"
import type * as HaltStrategy from "@effect/stream/Stream/HaltStrategy"

/** @internal */
export const Left: HaltStrategy.HaltStrategy = {
  _tag: OpCodes.OP_LEFT
}

/** @internal */
export const Right: HaltStrategy.HaltStrategy = {
  _tag: OpCodes.OP_RIGHT
}

/** @internal */
export const Both: HaltStrategy.HaltStrategy = {
  _tag: OpCodes.OP_BOTH
}

/** @internal */
export const Either: HaltStrategy.HaltStrategy = {
  _tag: OpCodes.OP_EITHER
}

/** @internal */
export const isLeft = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Left => self._tag === OpCodes.OP_LEFT

/** @internal */
export const isRight = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Right => self._tag === OpCodes.OP_RIGHT

/** @internal */
export const isBoth = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Both => self._tag === OpCodes.OP_BOTH

/** @internal */
export const isEither = (self: HaltStrategy.HaltStrategy): self is HaltStrategy.Either =>
  self._tag === OpCodes.OP_EITHER

/** @internal */
export const match = Debug.dual<
  <Z>(
    self: HaltStrategy.HaltStrategy,
    onLeft: () => Z,
    onRight: () => Z,
    onBoth: () => Z,
    onEither: () => Z
  ) => Z,
  <Z>(onLeft: () => Z, onRight: () => Z, onBoth: () => Z, onEither: () => Z) => (self: HaltStrategy.HaltStrategy) => Z
>(5, <Z>(
  self: HaltStrategy.HaltStrategy,
  onLeft: () => Z,
  onRight: () => Z,
  onBoth: () => Z,
  onEither: () => Z
): Z => {
  switch (self._tag) {
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
})
