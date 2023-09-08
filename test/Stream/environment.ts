import { toReadonlyArray } from "@effect/data/Chunk"
import * as Context from "@effect/data/Context"
import { pipe } from "@effect/data/Function"
import * as ReadonlyArray from "@effect/data/ReadonlyArray"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Layer from "@effect/io/Layer"
import type * as Tracer from "@effect/io/Tracer"
import * as Stream from "@effect/stream/Stream"
import * as it from "@effect/stream/test/utils/extend"
import { assert, describe } from "vitest"

interface StringService {
  readonly string: string
}

const StringService = Context.Tag<StringService>()

describe.concurrent("Stream", () => {
  it.effect("context", () =>
    Effect.gen(function*($) {
      const context = pipe(
        Context.empty(),
        Context.add(StringService, { string: "test" })
      )
      const result = yield* $(
        Stream.context<StringService>(),
        Stream.map(Context.get(StringService)),
        Stream.provideContext(context),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), [{ string: "test" }])
    }))

  it.effect("contextWith", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        StringService,
        Stream.provideContext(
          pipe(
            Context.empty(),
            Context.add(StringService, { string: "test" })
          )
        ),
        Stream.runHead,
        Effect.flatten
      )
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("contextWithEffect - success", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.contextWithEffect((context: Context.Context<StringService>) =>
          Effect.succeed(pipe(context, Context.get(StringService)))
        ),
        Stream.provideContext(
          pipe(
            Context.empty(),
            Context.add(StringService, { string: "test" })
          )
        ),
        Stream.runHead,
        Effect.flatten
      )
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("contextWithEffect - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.contextWithEffect((_: Context.Context<StringService>) => Effect.fail("boom")),
        Stream.provideContext(
          pipe(
            Context.empty(),
            Context.add(StringService, { string: "test" })
          )
        ),
        Stream.runHead,
        Effect.exit
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("contextWithStream - success", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.contextWithStream((context: Context.Context<StringService>) =>
          Stream.succeed(pipe(context, Context.get(StringService)))
        ),
        Stream.provideContext(
          pipe(
            Context.empty(),
            Context.add(StringService, { string: "test" })
          )
        ),
        Stream.runHead,
        Effect.flatten
      )
      assert.deepStrictEqual(result, { string: "test" })
    }))

  it.effect("contextWithStream - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.contextWithStream((_: Context.Context<StringService>) => Stream.fail("boom")),
        Stream.provideContext(
          pipe(
            Context.empty(),
            Context.add(StringService, { string: "test" })
          )
        ),
        Stream.runHead,
        Effect.exit
      )
      assert.deepStrictEqual(Exit.unannotate(result), Exit.fail("boom"))
    }))

  it.effect("provide", () =>
    Effect.gen(function*($) {
      const stream = StringService
      const layer = Layer.succeed(StringService, { string: "test" })
      const result = yield* $(
        stream,
        Stream.provideLayer(layer),
        Stream.map((s) => s.string),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("provideServiceStream", () =>
    Effect.gen(function*($) {
      const stream = StringService
      const service = Stream.succeed<StringService>({ string: "test" })
      const result = yield* $(
        stream,
        Stream.provideServiceStream(StringService, service),
        Stream.map((s) => s.string),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWith", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.map(StringService, (service) => service.string),
        Stream.provideLayer(Layer.succeed(StringService, { string: "test" })),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWithEffect", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.mapEffect(StringService, (service) => Effect.succeed(service.string)),
        Stream.provideLayer(Layer.succeed(StringService, { string: "test" })),
        Stream.runCollect
      )
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("serviceWithStream", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        Stream.flatMap(StringService, (service) => Stream.succeed(service.string)),
        Stream.provideLayer(Layer.succeed(StringService, { string: "test" })),
        Stream.runCollect
      )
      console.log("serviceWithStream")
      assert.deepStrictEqual(Array.from(result), ["test"])
    }))

  it.effect("deep provide", () =>
    Effect.gen(function*($) {
      const messages: Array<string> = []
      const effect = Effect.acquireRelease(
        pipe(StringService, Effect.tap((s) => Effect.sync(() => messages.push(s.string)))),
        () => pipe(StringService, Effect.tap((s) => Effect.sync(() => messages.push(s.string))))
      )
      const L0 = Layer.succeed(StringService, { string: "test0" })
      const L1 = Layer.succeed(StringService, { string: "test1" })
      const L2 = Layer.succeed(StringService, { string: "test2" })
      const stream = pipe(
        Stream.scoped(effect),
        Stream.provideSomeLayer(L1),
        Stream.concat(pipe(Stream.scoped(effect), Stream.provideSomeLayer(L2))),
        Stream.provideSomeLayer(L0)
      )
      yield* $(Stream.runDrain(stream))
      assert.deepStrictEqual(messages, ["test1", "test1", "test2", "test2"])
    }))

  it.effect("withSpan", () =>
    Effect.gen(function*(_) {
      const spans = yield* _(
        Stream.make(1, 2, 3),
        Stream.mapEffect((i) =>
          Effect.withSpan(
            Effect.currentSpan,
            `span.${i}`
          )
        ),
        Stream.withSpan("span"),
        Stream.runCollect,
        Effect.map(ReadonlyArray.compact)
      )
      expect(spans.length).toEqual(3)
      expect(pipe(
        ReadonlyArray.map(spans, (s) => s.parent),
        ReadonlyArray.compact,
        ReadonlyArray.filter((s): s is Tracer.Span => s._tag === "Span"),
        ReadonlyArray.map((s) => s.name)
      )).toEqual(["span", "span", "span"])
      expect(ReadonlyArray.map(spans, (s) => s.name)).toEqual(["span.1", "span.2", "span.3"])
    }))

  it.effect("serviceFunctions - expose Effect and Stream service functions as Streams", () => {
    interface Service {
      foo: (x: string, y: number) => Stream.Stream<never, never, string>
    }
    const Service = Context.Tag<Service>()
    const { foo } = Stream.serviceFunctions(Service)
    return pipe(
      Effect.gen(function*(_) {
        expect(toReadonlyArray(yield* _(Stream.runCollect(foo("a", 3))))).toEqual(["a3"])
      }),
      Effect.provideService(
        Service,
        Service.of({
          foo: (x, y) => Stream.fromIterable([`${x}${y}`])
        })
      )
    )
  })

  it.effect("serviceStreams - expose Effect and Stream service constants as Streams", () => {
    interface Service {
      baz: Stream.Stream<never, never, string>
      bazE: Effect.Effect<never, never, string>
    }
    const Service = Context.Tag<Service>()
    const { baz, bazE } = Stream.serviceStreams(Service)
    return pipe(
      Effect.gen(function*(_) {
        expect(toReadonlyArray(yield* _(Stream.runCollect(baz)))).toEqual(["42!"])
        expect(toReadonlyArray(yield* _(Stream.runCollect(bazE)))).toEqual(["42!"])
      }),
      Effect.provideService(
        Service,
        Service.of({
          baz: Stream.fromIterable(["42!"]),
          bazE: Effect.succeed("42!")
        })
      )
    )
  })

  it.effect("serviceConstants - expose non Effect nor Stream service constants as Streams", () => {
    interface Service {
      value: number
    }
    const Service = Context.Tag<Service>()
    const { value } = Stream.serviceConstants(Service)
    return pipe(
      Effect.gen(function*(_) {
        expect(toReadonlyArray(yield* _(Stream.runCollect(value)))).toEqual([42])
      }),
      Effect.provideService(
        Service,
        Service.of({ value: 42 })
      )
    )
  })
})
