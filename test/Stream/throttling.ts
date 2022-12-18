describe.concurrent.skip("Stream", () => {
  // TODO(Mike/Max): after `@effect/test`
  // suite("throttleEnforce")(
  //   test("free elements") {
  //     assertZIO(
  //       ZStream(1, 2, 3, 4)
  //         .throttleEnforce(0, Duration.Infinity)(_ => 0)
  //         .runCollect
  //     )(equalTo(Chunk(1, 2, 3, 4)))
  //   },
  //   test("no bandwidth") {
  //     assertZIO(
  //       ZStream(1, 2, 3, 4)
  //         .throttleEnforce(0, Duration.Infinity)(_ => 1)
  //         .runCollect
  //     )(equalTo(Chunk.empty))
  //   }
  // ),
  // suite("throttleShape")(
  //   test("throttleShape") {
  //     for {
  //       fiber <- Queue
  //                  .bounded[Int](10)
  //                  .flatMap { queue =>
  //                    ZIO.scoped {
  //                      ZStream
  //                        .fromQueue(queue)
  //                        .throttleShape(1, 1.second)(_.sum.toLong)
  //                        .toPull
  //                        .flatMap { pull =>
  //                          for {
  //                            _    <- queue.offer(1)
  //                            res1 <- pull
  //                            _    <- queue.offer(2)
  //                            res2 <- pull
  //                            _    <- Clock.sleep(4.seconds)
  //                            _    <- queue.offer(3)
  //                            res3 <- pull
  //                          } yield assert(Chunk(res1, res2, res3))(
  //                            equalTo(Chunk(Chunk(1), Chunk(2), Chunk(3)))
  //                          )
  //                        }
  //                    }
  //                  }
  //                  .fork
  //       _    <- TestClock.adjust(8.seconds)
  //       test <- fiber.join
  //     } yield test
  //   },
  //   test("infinite bandwidth") {
  //     Queue.bounded[Int](10).flatMap { queue =>
  //       ZIO.scoped {
  //         ZStream.fromQueue(queue).throttleShape(1, 0.seconds)(_ => 100000L).toPull.flatMap { pull =>
  //           for {
  //             _       <- queue.offer(1)
  //             res1    <- pull
  //             _       <- queue.offer(2)
  //             res2    <- pull
  //             elapsed <- Clock.currentTime(TimeUnit.SECONDS)
  //           } yield assert(elapsed)(equalTo(0L)) && assert(Chunk(res1, res2))(
  //             equalTo(Chunk(Chunk(1), Chunk(2)))
  //           )
  //         }
  //       }
  //     }
  //   },
  //   test("with burst") {
  //     for {
  //       fiber <- Queue
  //                  .bounded[Int](10)
  //                  .flatMap { queue =>
  //                    ZIO.scoped {
  //                      ZStream
  //                        .fromQueue(queue)
  //                        .throttleShape(1, 1.second, 2)(_.sum.toLong)
  //                        .toPull
  //                        .flatMap { pull =>
  //                          for {
  //                            _    <- queue.offer(1)
  //                            res1 <- pull
  //                            _    <- TestClock.adjust(2.seconds)
  //                            _    <- queue.offer(2)
  //                            res2 <- pull
  //                            _    <- TestClock.adjust(4.seconds)
  //                            _    <- queue.offer(3)
  //                            res3 <- pull
  //                          } yield assert(Chunk(res1, res2, res3))(
  //                            equalTo(Chunk(Chunk(1), Chunk(2), Chunk(3)))
  //                          )
  //                        }
  //                    }
  //                  }
  //                  .fork
  //       test <- fiber.join
  //     } yield test
  //   },
  //   test("free elements") {
  //     assertZIO(
  //       ZStream(1, 2, 3, 4)
  //         .throttleShape(1, Duration.Infinity)(_ => 0)
  //         .runCollect
  //     )(equalTo(Chunk(1, 2, 3, 4)))
  //   }
  // ),
  // suite("debounce")(
  //   test("should drop earlier chunks within waitTime") {
  //     assertWithChunkCoordination(List(Chunk(1), Chunk(3, 4), Chunk(5), Chunk(6, 7))) { c =>
  //       val stream = ZStream
  //         .fromQueue(c.queue)
  //         .collectWhileSuccess
  //         .debounce(1.second)
  //         .tap(_ => c.proceed)

  //       assertZIO(for {
  //         fiber  <- stream.runCollect.fork
  //         _      <- c.offer.fork
  //         _      <- (Clock.sleep(500.millis) *> c.offer).fork
  //         _      <- (Clock.sleep(2.seconds) *> c.offer).fork
  //         _      <- (Clock.sleep(2500.millis) *> c.offer).fork
  //         _      <- TestClock.adjust(3500.millis)
  //         result <- fiber.join
  //       } yield result)(equalTo(Chunk(Chunk(3, 4), Chunk(6, 7))))
  //     }
  //   },
  //   test("should take latest chunk within waitTime") {
  //     assertWithChunkCoordination(List(Chunk(1, 2), Chunk(3, 4), Chunk(5, 6))) { c =>
  //       val stream = ZStream
  //         .fromQueue(c.queue)
  //         .collectWhileSuccess
  //         .debounce(1.second)
  //         .tap(_ => c.proceed)

  //       assertZIO(for {
  //         fiber  <- stream.runCollect.fork
  //         _      <- c.offer *> c.offer *> c.offer
  //         _      <- TestClock.adjust(1.second)
  //         result <- fiber.join
  //       } yield result)(equalTo(Chunk(Chunk(5, 6))))
  //     }
  //   },
  //   test("should work properly with parallelization") {
  //     assertWithChunkCoordination(List(Chunk(1), Chunk(2), Chunk(3))) { c =>
  //       val stream = ZStream
  //         .fromQueue(c.queue)
  //         .collectWhileSuccess
  //         .debounce(1.second)
  //         .tap(_ => c.proceed)

  //       assertZIO(for {
  //         fiber  <- stream.runCollect.fork
  //         _      <- ZIO.collectAllParDiscard(List(c.offer, c.offer, c.offer))
  //         _      <- TestClock.adjust(1.second)
  //         result <- fiber.join
  //       } yield result)(hasSize(equalTo(1)))
  //     }
  //   },
  //   test("should handle empty chunks properly") {
  //     for {
  //       fiber  <- ZStream(1, 2, 3).schedule(Schedule.fixed(500.millis)).debounce(1.second).runCollect.fork
  //       _      <- TestClock.adjust(3.seconds)
  //       result <- fiber.join
  //     } yield assert(result)(equalTo(Chunk(3)))
  //   },
  //   test("should fail immediately") {
  //     val stream = ZStream.fromZIO(ZIO.fail(None)).debounce(Duration.Infinity)
  //     assertZIO(stream.runCollect.either)(isLeft(equalTo(None)))
  //   },
  //   test("should work with empty streams") {
  //     val stream = ZStream.empty.debounce(5.seconds)
  //     assertZIO(stream.runCollect)(isEmpty)
  //   },
  //   test("should pick last element from every chunk") {
  //     assertZIO(for {
  //       fiber  <- ZStream(1, 2, 3).debounce(1.second).runCollect.fork
  //       _      <- TestClock.adjust(1.second)
  //       result <- fiber.join
  //     } yield result)(equalTo(Chunk(3)))
  //   },
  //   test("should interrupt fibers properly") {
  //     assertWithChunkCoordination(List(Chunk(1), Chunk(2), Chunk(3))) { c =>
  //       for {
  //         fib <- ZStream
  //                  .fromQueue(c.queue)
  //                  .tap(_ => c.proceed)
  //                  .flatMap(ex => ZStream.fromZIOOption(ZIO.done(ex)))
  //                  .flattenChunks
  //                  .debounce(200.millis)
  //                  .interruptWhen(ZIO.never)
  //                  .take(1)
  //                  .runCollect
  //                  .fork
  //         _       <- (c.offer *> TestClock.adjust(100.millis) *> c.awaitNext).repeatN(3)
  //         _       <- TestClock.adjust(100.millis)
  //         results <- fib.join
  //       } yield assert(results)(equalTo(Chunk(3)))
  //     }
  //   },
  //   test("should interrupt children fiber on stream interruption") {
  //     for {
  //       ref <- Ref.make(false)
  //       fiber <- (ZStream.fromZIO(ZIO.unit) ++ ZStream.fromZIO(ZIO.never.onInterrupt(ref.set(true))))
  //                  .debounce(800.millis)
  //                  .runDrain
  //                  .fork
  //       _     <- TestClock.adjust(1.minute)
  //       _     <- fiber.interrupt
  //       value <- ref.get
  //     } yield assert(value)(equalTo(true))
  //   }
  // ) @@ TestAspect.timeout(40.seconds),
})
