import * as Chunk from "@effect/data/Chunk"
import { constFalse, constTrue, dual, pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Cause from "@effect/io/Cause"
import { dualWithTrace, methodWithTrace } from "@effect/io/Debug"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import type * as Take from "@effect/stream/Take"

/** @internal */
const TakeSymbolKey = "@effect/stream/Take"

/** @internal */
export const TakeTypeId: Take.TakeTypeId = Symbol.for(
  TakeSymbolKey
) as Take.TakeTypeId

/** @internal */
const takeVariance = {
  _E: (_: never) => _,
  _A: (_: never) => _
}

/** @internal */
export class TakeImpl<E, A> implements Take.Take<E, A> {
  readonly [TakeTypeId] = takeVariance
  constructor(readonly exit: Exit.Exit<Option.Option<E>, Chunk.Chunk<A>>) {
  }
}

/** @internal */
export const chunk = <A>(chunk: Chunk.Chunk<A>): Take.Take<never, A> => new TakeImpl(Exit.succeed(chunk))

/** @internal */
export const die = (defect: unknown): Take.Take<never, never> => new TakeImpl(Exit.die(defect))

/** @internal */
export const dieMessage = (message: string): Take.Take<never, never> =>
  new TakeImpl(Exit.die(Cause.RuntimeException(message)))

/** @internal */
export const done = methodWithTrace((trace) =>
  <E, A>(self: Take.Take<E, A>): Effect.Effect<never, Option.Option<E>, Chunk.Chunk<A>> =>
    pipe(Effect.done(self.exit)).traced(trace)
)

/** @internal */
export const end: Take.Take<never, never> = new TakeImpl(Exit.fail(Option.none()))

/** @internal */
export const fail = <E>(error: E): Take.Take<E, never> => new TakeImpl(Exit.fail(Option.some(error)))

/** @internal */
export const failCause = <E>(cause: Cause.Cause<E>): Take.Take<E, never> =>
  new TakeImpl(Exit.failCause(pipe(cause, Cause.map(Option.some))))

/** @internal */
export const fromEffect = methodWithTrace((trace) =>
  <R, E, A>(effect: Effect.Effect<R, E, A>): Effect.Effect<R, never, Take.Take<E, A>> =>
    pipe(effect, Effect.matchCause(failCause, of)).traced(trace)
)

/** @internal */
export const fromExit = <E, A>(exit: Exit.Exit<E, A>): Take.Take<E, A> =>
  new TakeImpl(pipe(exit, Exit.mapBoth(Option.some, Chunk.of)))

/** @internal */
export const fromPull = methodWithTrace((trace) =>
  <R, E, A>(
    pull: Effect.Effect<R, Option.Option<E>, Chunk.Chunk<A>>
  ): Effect.Effect<R, never, Take.Take<E, A>> =>
    pipe(
      pull,
      Effect.matchCause((cause) =>
        pipe(
          Cause.flipCauseOption(cause),
          Option.match(() => end, failCause)
        ), chunk)
    ).traced(trace)
)

/** @internal */
export const isDone = <E, A>(self: Take.Take<E, A>): boolean =>
  pipe(
    self.exit,
    Exit.match(
      (cause) => Option.isNone(Cause.flipCauseOption(cause)),
      constFalse
    )
  )

/** @internal */
export const isFailure = <E, A>(self: Take.Take<E, A>): boolean =>
  pipe(
    self.exit,
    Exit.match(
      (cause) => Option.isSome(Cause.flipCauseOption(cause)),
      constFalse
    )
  )

/** @internal */
export const isSuccess = <E, A>(self: Take.Take<E, A>): boolean =>
  pipe(
    self.exit,
    Exit.match(constFalse, constTrue)
  )

/** @internal */
export const make = <E, A>(
  exit: Exit.Exit<Option.Option<E>, Chunk.Chunk<A>>
): Take.Take<E, A> => new TakeImpl(exit)

/** @internal */
export const match = dual<
  <Z, E, Z2, A, Z3>(
    onEnd: () => Z,
    onError: (cause: Cause.Cause<E>) => Z2,
    onSuccess: (chunk: Chunk.Chunk<A>) => Z3
  ) => (self: Take.Take<E, A>) => Z | Z2 | Z3,
  <Z, E, Z2, A, Z3>(
    self: Take.Take<E, A>,
    onEnd: () => Z,
    onError: (cause: Cause.Cause<E>) => Z2,
    onSuccess: (chunk: Chunk.Chunk<A>) => Z3
  ) => Z | Z2 | Z3
>(4, <Z, E, Z2, A, Z3>(
  self: Take.Take<E, A>,
  onEnd: () => Z,
  onError: (cause: Cause.Cause<E>) => Z2,
  onSuccess: (chunk: Chunk.Chunk<A>) => Z3
): Z | Z2 | Z3 =>
  pipe(
    self.exit,
    Exit.match<Option.Option<E>, Chunk.Chunk<A>, Z | Z2 | Z3>(
      (cause) => pipe(Cause.flipCauseOption(cause), Option.match(onEnd, onError)),
      onSuccess
    )
  ))

/** @internal */
export const matchEffect = dualWithTrace<
  <R, E2, Z, R2, E, Z2, A, R3, E3, Z3>(
    onEnd: () => Effect.Effect<R, E2, Z>,
    onError: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, Z2>,
    onSuccess: (chunk: Chunk.Chunk<A>) => Effect.Effect<R3, E3, Z3>
  ) => (self: Take.Take<E, A>) => Effect.Effect<R | R2 | R3, E2 | E | E3, Z | Z2 | Z3>,
  <R, E2, Z, R2, E, Z2, A, R3, E3, Z3>(
    self: Take.Take<E, A>,
    onEnd: () => Effect.Effect<R, E2, Z>,
    onError: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, Z2>,
    onSuccess: (chunk: Chunk.Chunk<A>) => Effect.Effect<R3, E3, Z3>
  ) => Effect.Effect<R | R2 | R3, E2 | E | E3, Z | Z2 | Z3>
>(4, (trace) =>
  <R, E2, Z, R2, E, Z2, A, R3, E3, Z3>(
    self: Take.Take<E, A>,
    onEnd: () => Effect.Effect<R, E2, Z>,
    onError: (cause: Cause.Cause<E>) => Effect.Effect<R2, E2, Z2>,
    onSuccess: (chunk: Chunk.Chunk<A>) => Effect.Effect<R3, E3, Z3>
  ): Effect.Effect<R | R2 | R3, E | E2 | E3, Z | Z2 | Z3> =>
    pipe(
      self.exit,
      Exit.matchEffect<Option.Option<E>, Chunk.Chunk<A>, R | R2, E | E2, Z | Z2, R3, E3, Z3>(
        (cause) => pipe(Cause.flipCauseOption(cause), Option.match(onEnd, onError)),
        onSuccess
      )
    ).traced(trace))

/** @internal */
export const map = dual<
  <A, B>(f: (a: A) => B) => <E>(self: Take.Take<E, A>) => Take.Take<E, B>,
  <E, A, B>(self: Take.Take<E, A>, f: (a: A) => B) => Take.Take<E, B>
>(
  2,
  <E, A, B>(self: Take.Take<E, A>, f: (a: A) => B): Take.Take<E, B> =>
    new TakeImpl(pipe(self.exit, Exit.map(Chunk.map(f))))
)

/** @internal */
export const of = <A>(value: A): Take.Take<never, A> => new TakeImpl(Exit.succeed(Chunk.of(value)))

/** @internal */
export const tap = dualWithTrace<
  <A, R, E2, _>(
    f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R, E2, _>
  ) => <E>(self: Take.Take<E, A>) => Effect.Effect<R, E2 | E, void>,
  <E, A, R, E2, _>(
    self: Take.Take<E, A>,
    f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R, E2, _>
  ) => Effect.Effect<R, E2 | E, void>
>(
  2,
  (trace) =>
    <E, A, R, E2, _>(
      self: Take.Take<E, A>,
      f: (chunk: Chunk.Chunk<A>) => Effect.Effect<R, E2, _>
    ): Effect.Effect<R, E | E2, void> => pipe(self.exit, Exit.forEachEffect(f), Effect.asUnit).traced(trace)
)
