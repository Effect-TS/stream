import * as Cause from "@effect/io/Cause"
import * as Debug from "@effect/io/Debug"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Ref from "@effect/io/Ref"
import type * as SingleProducerAsyncInput from "@effect/stream/Channel/SingleProducerAsyncInput"
import * as Either from "@fp-ts/core/Either"
import { pipe } from "@fp-ts/core/Function"

/** @internal */
type State<Err, Elem, _Done> =
  | Empty
  | Emit<Err, Elem, _Done>
  | Error<Err>
  | Done<_Done>

/** @internal */
const OP_STATE_EMPTY = "Empty" as const

/** @internal */
type OP_STATE_EMPTY = typeof OP_STATE_EMPTY

/** @internal */
const OP_STATE_EMIT = "Emit" as const

/** @internal */
type OP_STATE_EMIT = typeof OP_STATE_EMIT

/** @internal */
const OP_STATE_ERROR = "Error" as const

/** @internal */
type OP_STATE_ERROR = typeof OP_STATE_ERROR

/** @internal */
const OP_STATE_DONE = "Done" as const

/** @internal */
type OP_STATE_DONE = typeof OP_STATE_DONE

/** @internal */
interface Empty {
  readonly _tag: OP_STATE_EMPTY
  readonly notifyProducer: Deferred.Deferred<never, void>
}

/** @internal */
interface Emit<Err, Elem, Done> {
  readonly _tag: OP_STATE_EMIT
  readonly notifyConsumers: ReadonlyArray<Deferred.Deferred<Err, Either.Either<Done, Elem>>>
}

/** @internal */
interface Error<Err> {
  readonly _tag: OP_STATE_ERROR
  readonly cause: Cause.Cause<Err>
}

/** @internal */
interface Done<_Done> {
  readonly _tag: OP_STATE_DONE
  readonly done: _Done
}

/** @internal */
const stateEmpty = (notifyProducer: Deferred.Deferred<never, void>): State<never, never, never> => ({
  _tag: OP_STATE_EMPTY,
  notifyProducer
})

/** @internal */
const stateEmit = <Err, Elem, Done>(
  notifyConsumers: ReadonlyArray<Deferred.Deferred<Err, Either.Either<Done, Elem>>>
): State<Err, Elem, Done> => ({
  _tag: OP_STATE_EMIT,
  notifyConsumers
})

/** @internal */
const stateError = <Err>(cause: Cause.Cause<Err>): State<Err, never, never> => ({
  _tag: OP_STATE_ERROR,
  cause
})

/** @internal */
const stateDone = <Done>(done: Done): State<never, never, Done> => ({
  _tag: OP_STATE_DONE,
  done
})

/** @internal */
class SingleProducerAsyncInputImpl<Err, Elem, Done>
  implements SingleProducerAsyncInput.SingleProducerAsyncInput<Err, Elem, Done>
{
  constructor(readonly ref: Ref.Ref<State<Err, Elem, Done>>) {
  }

  awaitRead(): Effect.Effect<never, never, unknown> {
    return Debug.bodyWithTrace((trace) => {
      return pipe(
        Ref.modify(this.ref, (state) =>
          state._tag === OP_STATE_EMPTY ?
            [Deferred.await(state.notifyProducer), state as State<Err, Elem, Done>] :
            [Effect.unit(), state]),
        Effect.flatten
      ).traced(trace)
    })
  }

  close(): Effect.Effect<never, never, unknown> {
    return Debug.bodyWithTrace((trace) => {
      return Effect.fiberIdWith(
        (fiberId) => this.error(Cause.interrupt(fiberId))
      ).traced(trace)
    })
  }

  done(value: Done): Effect.Effect<never, never, unknown> {
    return Debug.bodyWithTrace((trace) => {
      return pipe(
        Ref.modify(this.ref, (state) => {
          switch (state._tag) {
            case OP_STATE_EMPTY: {
              return [Deferred.await(state.notifyProducer), state]
            }
            case OP_STATE_EMIT: {
              return [
                pipe(
                  state.notifyConsumers,
                  Effect.forEachDiscard((deferred) => Deferred.succeed(deferred, Either.left(value)))
                ),
                stateDone(value) as State<Err, Elem, Done>
              ]
            }
            case OP_STATE_ERROR: {
              return [Effect.interrupt(), state]
            }
            case OP_STATE_DONE: {
              return [Effect.interrupt(), state]
            }
          }
        }),
        Effect.flatten
      ).traced(trace)
    })
  }

  emit(element: Elem): Effect.Effect<never, never, unknown> {
    return Debug.bodyWithTrace((trace) => {
      return pipe(
        Deferred.make<never, void>(),
        Effect.flatMap((deferred) =>
          pipe(
            Ref.modify(this.ref, (state) => {
              switch (state._tag) {
                case OP_STATE_EMPTY: {
                  return [Deferred.await(state.notifyProducer), state]
                }
                case OP_STATE_EMIT: {
                  const notifyConsumer = state.notifyConsumers[0]
                  const notifyConsumers = state.notifyConsumers.slice(1)
                  if (notifyConsumer !== undefined) {
                    return [
                      Deferred.succeed(notifyConsumer, Either.right(element)),
                      (notifyConsumers.length === 0 ?
                        stateEmpty(deferred) :
                        stateEmit(notifyConsumers)) as State<Err, Elem, Done>
                    ]
                  }
                  throw new Error(
                    "Bug: Channel.SingleProducerAsyncInput.emit - Queue was empty! Please report an issue at https://github.com/Effect-TS/stream/issues"
                  )
                }
                case OP_STATE_ERROR: {
                  return [Effect.interrupt(), state]
                }
                case OP_STATE_DONE: {
                  return [Effect.interrupt(), state]
                }
              }
            }),
            Effect.flatten
          )
        )
      ).traced(trace)
    })
  }

  error(cause: Cause.Cause<Err>): Effect.Effect<never, never, unknown> {
    return Debug.bodyWithTrace((trace) => {
      return pipe(
        Ref.modify(this.ref, (state) => {
          switch (state._tag) {
            case OP_STATE_EMPTY: {
              return [Deferred.await(state.notifyProducer), state]
            }
            case OP_STATE_EMIT: {
              return [
                pipe(
                  state.notifyConsumers,
                  Effect.forEachDiscard((deferred) => Deferred.failCause(deferred, cause))
                ),
                stateError(cause) as State<Err, Elem, Done>
              ]
            }
            case OP_STATE_ERROR: {
              return [Effect.interrupt(), state]
            }
            case OP_STATE_DONE: {
              return [Effect.interrupt(), state]
            }
          }
        }),
        Effect.flatten
      ).traced(trace)
    })
  }

  take(): Effect.Effect<never, never, Exit.Exit<Either.Either<Err, Done>, Elem>> {
    return Debug.bodyWithTrace((trace) => {
      return this.takeWith(
        (cause) => Exit.failCause(pipe(cause, Cause.map(Either.left))),
        (elem) => Exit.succeed(elem) as Exit.Exit<Either.Either<Err, Done>, Elem>,
        (done) => Exit.fail(Either.right(done))
      ).traced(trace)
    })
  }

  takeWith<A>(
    onError: (cause: Cause.Cause<Err>) => A,
    onElement: (element: Elem) => A,
    onDone: (value: Done) => A
  ): Effect.Effect<never, never, A> {
    return Debug.bodyWithTrace((trace) => {
      return pipe(
        Deferred.make<Err, Either.Either<Done, Elem>>(),
        Effect.flatMap((deferred) =>
          pipe(
            Ref.modify(this.ref, (state) => {
              switch (state._tag) {
                case OP_STATE_EMPTY: {
                  return [
                    pipe(
                      Deferred.succeed<never, void>(state.notifyProducer, void 0),
                      Effect.zipRight(
                        pipe(
                          Deferred.await(deferred),
                          Effect.matchCause(onError, Either.match(onDone, onElement))
                        )
                      )
                    ),
                    stateEmit([deferred])
                  ]
                }
                case OP_STATE_EMIT: {
                  return [
                    pipe(
                      Deferred.await(deferred),
                      Effect.matchCause(onError, Either.match(onDone, onElement))
                    ),
                    stateEmit([...state.notifyConsumers, deferred])
                  ]
                }
                case OP_STATE_ERROR: {
                  return [Effect.succeed(onError(state.cause)), state]
                }
                case OP_STATE_DONE: {
                  return [Effect.succeed(onDone(state.done)), state]
                }
              }
            }),
            Effect.flatten
          )
        )
      ).traced(trace)
    })
  }
}

/** @internal */
export const make = Debug.methodWithTrace((trace) =>
  <Err, Elem, Done>(): Effect.Effect<
    never,
    never,
    SingleProducerAsyncInput.SingleProducerAsyncInput<Err, Elem, Done>
  > =>
    pipe(
      Deferred.make<never, void>(),
      Effect.flatMap((deferred) => Ref.make(stateEmpty(deferred) as State<Err, Elem, Done>)),
      Effect.map((ref) => new SingleProducerAsyncInputImpl(ref))
    ).traced(trace)
)
