import * as STM from "@effect/stm/STM"

describe("Dummy", () => {
  it("ok", () => {
    expect(STM.succeed(0)).toEqual(STM.succeed(0))
  })
})
