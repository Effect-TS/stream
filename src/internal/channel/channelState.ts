import * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import type { ErasedExecutor } from "@effect/stream/internal/channel/channelExecutor"
import * as OpCodes from "@effect/stream/internal/opCodes/channelState"

/** @internal */
export const ChannelStateTypeId = Symbol.for("@effect/stream/Channel/State")

/** @internal */
export type ChannelStateTypeId = typeof ChannelStateTypeId

/** @internal */
export interface ChannelState<R, E> extends ChannelState.Variance<R, E> {}

/** @internal */
export declare namespace ChannelState {
  export interface Variance<R, E> {
    readonly [ChannelStateTypeId]: {
      readonly _R: (_: never) => R
      readonly _E: (_: never) => E
    }
  }
}

/** @internal */
const channelStateVariance = {
  _R: (_: never) => _,
  _E: (_: never) => _
}

/** @internal */
const proto = {
  [ChannelStateTypeId]: channelStateVariance
}

/** @internal */
export type Primitive =
  | Done
  | Emit
  | FromEffect
  | Read

/** @internal */
export type Op<Tag extends string, Body = {}> = ChannelState<never, never> & Body & {
  readonly _tag: Tag
}

/** @internal */
export interface Done extends Op<OpCodes.OP_DONE, {}> {}

/** @internal */
export interface Emit extends Op<OpCodes.OP_EMIT, {}> {}

/** @internal */
export interface FromEffect extends
  Op<OpCodes.OP_FROM_EFFECT, {
    readonly effect: Effect.Effect<unknown, unknown, unknown>
  }>
{}

/** @internal */
export interface Read extends
  Op<OpCodes.OP_READ, {
    readonly upstream: ErasedExecutor<unknown>
    readonly onEffect: (effect: Effect.Effect<unknown, never, void>) => Effect.Effect<unknown, never, void>
    readonly onEmit: (value: unknown) => Effect.Effect<unknown, never, void>
    readonly onDone: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown, never, void>
  }>
{}

/** @internal */
export const Done: ChannelState<never, never> = Object.create(proto, {
  _tag: { value: OpCodes.OP_DONE }
})

/** @internal */
export const Emit: ChannelState<never, never> = Object.create(proto, {
  _tag: { value: OpCodes.OP_EMIT }
})

/** @internal */
export const FromEffect = <R, E, _>(effect: Effect.Effect<R, E, _>): ChannelState<R, E> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_FROM_EFFECT },
    effect: { value: effect }
  })

/** @internal */
export const Read = <R>(
  upstream: ErasedExecutor<R>,
  onEffect: (effect: Effect.Effect<R, never, void>) => Effect.Effect<R, never, void>,
  onEmit: (value: unknown) => Effect.Effect<R, never, void> | undefined,
  onDone: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<R, never, void> | undefined
): ChannelState<R, never> =>
  Object.create(proto, {
    _tag: { value: OpCodes.OP_READ },
    upstream: { value: upstream },
    onEffect: { value: onEffect },
    onEmit: { value: onEmit },
    onDone: { value: onDone }
  })

/** @internal */
export const isChannelState = (u: unknown): u is ChannelState<unknown, unknown> => {
  return typeof u === "object" && u != null && ChannelStateTypeId in u
}

/** @internal */
export const isDone = <R, E>(self: ChannelState<R, E>): self is Done => {
  return (self as Primitive)._tag === OpCodes.OP_DONE
}

/** @internal */
export const isEmit = <R, E>(self: ChannelState<R, E>): self is Emit => {
  return (self as Primitive)._tag === OpCodes.OP_EMIT
}

/** @internal */
export const isFromEffect = <R, E>(self: ChannelState<R, E>): self is FromEffect => {
  return (self as Primitive)._tag === OpCodes.OP_FROM_EFFECT
}

/** @internal */
export const isRead = <R, E>(self: ChannelState<R, E>): self is Read => {
  return (self as Primitive)._tag === OpCodes.OP_READ
}

/** @internal */
export const effect = <R, E>(self: ChannelState<R, E>): Effect.Effect<R, E, void> => {
  return isFromEffect(self) ? self.effect as Effect.Effect<R, E, void> : Effect.unit()
}

/** @internal */
export const effectOrUndefinedIgnored = <R, E>(self: ChannelState<R, E>): Effect.Effect<R, E, void> | undefined => {
  return isFromEffect(self) ? Effect.ignore(self.effect as Effect.Effect<R, E, void>) : undefined
}
