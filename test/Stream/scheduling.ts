describe.concurrent.skip("Stream", () => {
  // TODO(Mike/Max): after `@effect/test`
  // suite("schedule")(
  //   test("schedule") {
  //     for {
  //       start <- Clock.currentTime(TimeUnit.MILLISECONDS)
  //       fiber <- ZStream
  //                  .range(1, 9)
  //                  .schedule(Schedule.fixed(100.milliseconds))
  //                  .mapZIO(n => Clock.currentTime(TimeUnit.MILLISECONDS).map(now => (n, now - start)))
  //                  .runCollect
  //                  .fork
  //       _       <- TestClock.adjust(800.millis)
  //       actual  <- fiber.join
  //       expected = Chunk((1, 100L), (2, 200L), (3, 300L), (4, 400L), (5, 500L), (6, 600L), (7, 700L), (8, 800L))
  //     } yield assertTrue(actual == expected)
  //   },
  //   test("scheduleWith")(
  //     assertZIO(
  //       ZStream("A", "B", "C", "A", "B", "C")
  //         .scheduleWith(Schedule.recurs(2) *> Schedule.fromFunction((_) => "Done"))(
  //           _.toLowerCase,
  //           identity
  //         )
  //         .runCollect
  //     )(equalTo(Chunk("a", "b", "c", "Done", "a", "b", "c", "Done")))
  //   ),
  //   test("scheduleEither")(
  //     assertZIO(
  //       ZStream("A", "B", "C")
  //         .scheduleEither(Schedule.recurs(2) *> Schedule.fromFunction((_) => "!"))
  //         .runCollect
  //     )(equalTo(Chunk(Right("A"), Right("B"), Right("C"), Left("!"))))
  //   )
  // ),
})
