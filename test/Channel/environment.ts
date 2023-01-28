import * as Effect from "@effect/io/Effect"
import * as Channel from "@effect/stream/Channel"
import * as it from "@effect/stream/test/utils/extend"
import { pipe } from "@fp-ts/core/Function"
import * as Context from "@fp-ts/data/Context"
import * as Equal from "@fp-ts/data/Equal"
import * as Hash from "@fp-ts/data/Hash"
import { assert, describe } from "vitest"

const NumberServiceSymbolKey = "@effect/stream/test/NumberService"

const NumberServiceTypeId = Symbol.for(NumberServiceSymbolKey)

type NumberServiceTypeId = typeof NumberServiceTypeId

export interface NumberService extends Equal.Equal {
  readonly [NumberServiceTypeId]: NumberServiceTypeId
  readonly n: number
}

export const NumberService = Context.Tag<NumberService>()

export class NumberServiceImpl implements NumberService {
  readonly [NumberServiceTypeId]: NumberServiceTypeId = NumberServiceTypeId

  constructor(readonly n: number) {}

  [Hash.symbol](): number {
    return pipe(
      Hash.hash(NumberServiceSymbolKey),
      Hash.combine(Hash.hash(this.n))
    )
  }

  [Equal.symbol](u: unknown): boolean {
    return isNumberService(u) && u.n === this.n
  }
}

export const isNumberService = (u: unknown): u is NumberService => {
  return typeof u === "object" && u != null && NumberServiceTypeId in u
}

describe.concurrent("Channel", () => {
  it.effect("provide - simple", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Channel.fromEffect(Effect.service(NumberService)),
          Channel.provideService(NumberService, new NumberServiceImpl(100)),
          Channel.run
        )
      )
      assert.deepStrictEqual(result, new NumberServiceImpl(100))
    }))

  it.effect("provide -> zip -> provide", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Channel.fromEffect(Effect.service(NumberService)),
          Channel.provideService(NumberService, new NumberServiceImpl(100)),
          Channel.zip(
            pipe(
              Channel.fromEffect(Effect.service(NumberService)),
              Channel.provideService(NumberService, new NumberServiceImpl(200))
            )
          ),
          Channel.run
        )
      )
      assert.deepStrictEqual(result, [new NumberServiceImpl(100), new NumberServiceImpl(200)])
    }))

  it.effect("concatMap(provide).provide", () =>
    Effect.gen(function*($) {
      const [chunk, value] = yield* $(pipe(
        Channel.fromEffect(Effect.service(NumberService)),
        Channel.emitCollect,
        Channel.mapOut((tuple) => tuple[1]),
        Channel.concatMap((n) =>
          pipe(
            Channel.fromEffect(pipe(Effect.service(NumberService), Effect.map((m) => [n, m] as const))),
            Channel.provideService(NumberService, new NumberServiceImpl(200)),
            Channel.flatMap(Channel.write)
          )
        ),
        Channel.provideService(NumberService, new NumberServiceImpl(100)),
        Channel.runCollect
      ))
      assert.deepStrictEqual(Array.from(chunk), [[new NumberServiceImpl(100), new NumberServiceImpl(200)] as const])
      assert.isUndefined(value)
    }))

  it.effect("provide is modular", () =>
    Effect.gen(function*($) {
      const channel1 = Channel.fromEffect(Effect.service(NumberService))
      const channel2 = pipe(
        Effect.service(NumberService),
        Effect.provideContext(pipe(Context.empty(), Context.add(NumberService)(new NumberServiceImpl(2)))),
        Channel.fromEffect
      )
      const channel3 = Channel.fromEffect(Effect.service(NumberService))
      const [[result1, result2], result3] = yield* $(pipe(
        channel1,
        Channel.zip(channel2),
        Channel.zip(channel3),
        Channel.runDrain,
        Effect.provideService(NumberService, new NumberServiceImpl(4))
      ))
      assert.deepStrictEqual(result1, new NumberServiceImpl(4))
      assert.deepStrictEqual(result2, new NumberServiceImpl(2))
      assert.deepStrictEqual(result3, new NumberServiceImpl(4))
    }))
})
