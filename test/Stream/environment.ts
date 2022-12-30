import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Layer from "@effect/io/Layer"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import * as Context from "@fp-ts/data/Context"
import { pipe } from "@fp-ts/data/Function"
import { assert, describe } from "vitest"

interface StringService {
  readonly string: string
}

const StringService = Context.Tag<StringService>()

describe.concurrent("Stream", () => {
  it.effect("environment", () =>
    Effect.gen(function*($) {
      const environment = pipe(
        Context.empty(),
        Context.add(StringService)({ string: "test" })
      )
      const result = yield* $(pipe(
        Stream.environment<StringService>(),
        Stream.map(Context.get(StringService)),
        Stream.provideEnvironment(environment),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), [{ string: "test" }])
    }))

  it.effect("environmentWith", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.service(StringService),
        Stream.provideEnvironment(
          pipe(
            Context.empty(),
            Context.add(StringService)({ string: "test" })
          )
        ),
        Stream.runHead,
        Effect.some
      ))
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("environmentWithEffect - success", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.environmentWithEffect((context: Context.Context<StringService>) =>
          Effect.succeed(pipe(context, Context.get(StringService)))
        ),
        Stream.provideEnvironment(
          pipe(
            Context.empty(),
            Context.add(StringService)({ string: "test" })
          )
        ),
        Stream.runHead,
        Effect.some
      ))
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("environmentWithEffect - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.environmentWithEffect((_: Context.Context<StringService>) => Effect.fail("boom")),
        Stream.provideEnvironment(
          pipe(
            Context.empty(),
            Context.add(StringService)({ string: "test" })
          )
        ),
        Stream.runHead,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("environmentWithStream - success", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.environmentWithStream((context: Context.Context<StringService>) =>
          Stream.succeed(pipe(context, Context.get(StringService)))
        ),
        Stream.provideEnvironment(
          pipe(
            Context.empty(),
            Context.add(StringService)({ string: "test" })
          )
        ),
        Stream.runHead,
        Effect.some
      ))
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("environmentWithStream - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.environmentWithStream((_: Context.Context<StringService>) => Stream.fail("boom")),
        Stream.provideEnvironment(
          pipe(
            Context.empty(),
            Context.add(StringService)({ string: "test" })
          )
        ),
        Stream.runHead,
        Effect.exit
      ))
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("provide", () =>
    Effect.gen(function*($) {
      const stream = Stream.service(StringService)
      const layer = Layer.succeed(StringService)({ string: "test" })
      const result = yield* $(pipe(
        stream,
        Stream.provideLayer(layer),
        Stream.map((s) => s.string),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("provideServiceStream", () =>
    Effect.gen(function*($) {
      const stream = Stream.service(StringService)
      const service = Stream.succeed<StringService>({ string: "test" })
      const result = yield* $(pipe(
        stream,
        Stream.provideServiceStream(StringService)(service),
        Stream.map((s) => s.string),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWith", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.serviceWith(StringService)((service) => service.string),
        Stream.provideLayer(Layer.succeed(StringService)({ string: "test" })),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWithEffect", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.serviceWithEffect(StringService)((service) => Effect.succeed(service.string)),
        Stream.provideLayer(Layer.succeed(StringService)({ string: "test" })),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWithStream", () =>
    Effect.gen(function*($) {
      const result = yield* $(pipe(
        Stream.serviceWithStream(StringService)((service) => Stream.succeed(service.string)),
        Stream.provideLayer(Layer.succeed(StringService)({ string: "test" })),
        Stream.runCollect
      ))
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("deep provide", () =>
    Effect.gen(function*($) {
      const messages: Array<string> = []
      const effect = Effect.acquireRelease(
        pipe(Effect.service(StringService), Effect.tap((s) => Effect.sync(() => messages.push(s.string)))),
        () => pipe(Effect.service(StringService), Effect.tap((s) => Effect.sync(() => messages.push(s.string))))
      )
      const L0 = Layer.succeed(StringService)({ string: "test0" })
      const L1 = Layer.succeed(StringService)({ string: "test1" })
      const L2 = Layer.succeed(StringService)({ string: "test2" })
      const stream = pipe(
        Stream.scoped(effect),
        Stream.provideSomeLayer(L1),
        Stream.concat(pipe(Stream.scoped(effect), Stream.provideSomeLayer(L2))),
        Stream.provideSomeLayer(L0)
      )
      yield* $(Stream.runDrain(stream))
      assert.deepStrictEqual(messages, ["test1", "test1", "test2", "test2"])
    }))
})
