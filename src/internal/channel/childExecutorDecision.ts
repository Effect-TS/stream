import * as Debug from "@effect/io/Debug"
import type * as ChildExecutorDecision from "@effect/stream/Channel/ChildExecutorDecision"
import * as OpCodes from "@effect/stream/internal/opCodes/childExecutorDecision"

/** @internal */
const ChildExecutorDecisionSymbolKey = "@effect/stream/Channel/ChildExecutorDecision"

/** @internal */
export const ChildExecutorDecisionTypeId: ChildExecutorDecision.ChildExecutorDecisionTypeId = Symbol.for(
  ChildExecutorDecisionSymbolKey
) as ChildExecutorDecision.ChildExecutorDecisionTypeId

/** @internal */
const proto = {
  [ChildExecutorDecisionTypeId]: ChildExecutorDecisionTypeId
}

/** @internal */
export const Continue: ChildExecutorDecision.ChildExecutorDecision = Object.create(proto, {
  _tag: { value: OpCodes.OP_CONTINUE }
})

/** @internal */
export const Close = (value: unknown): ChildExecutorDecision.ChildExecutorDecision =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_CLOSE },
    value: { value }
  })

/** @internal */
export const Yield: ChildExecutorDecision.ChildExecutorDecision = Object.create(proto, {
  _tag: { value: OpCodes.OP_YIELD }
})

/** @internal */
export const isChildExecutorDecision = (u: unknown): u is ChildExecutorDecision.ChildExecutorDecision => {
  return typeof u === "object" && u != null && ChildExecutorDecisionTypeId in u
}

/** @internal */
export const isContinue = (
  self: ChildExecutorDecision.ChildExecutorDecision
): self is ChildExecutorDecision.Continue => {
  return self._tag === OpCodes.OP_CONTINUE
}

/** @internal */
export const isClose = (
  self: ChildExecutorDecision.ChildExecutorDecision
): self is ChildExecutorDecision.Close => {
  return self._tag === OpCodes.OP_CLOSE
}

/** @internal */
export const isYield = (
  self: ChildExecutorDecision.ChildExecutorDecision
): self is ChildExecutorDecision.Yield => {
  return self._tag === OpCodes.OP_YIELD
}

/** @internal */
export const match = Debug.dual<
  <A>(
    self: ChildExecutorDecision.ChildExecutorDecision,
    onContinue: () => A,
    onClose: (value: unknown) => A,
    onYield: () => A
  ) => A,
  <A>(
    onContinue: () => A,
    onClose: (value: unknown) => A,
    onYield: () => A
  ) => (self: ChildExecutorDecision.ChildExecutorDecision) => A
>(4, <A>(
  self: ChildExecutorDecision.ChildExecutorDecision,
  onContinue: () => A,
  onClose: (value: unknown) => A,
  onYield: () => A
): A => {
  switch (self._tag) {
    case OpCodes.OP_CONTINUE: {
      return onContinue()
    }
    case OpCodes.OP_CLOSE: {
      return onClose(self.value)
    }
    case OpCodes.OP_YIELD: {
      return onYield()
    }
  }
})
