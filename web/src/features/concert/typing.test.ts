import { describe, expect, it } from "vitest";
import { typingSteps } from "./typing";

describe("typingSteps", () => {
  it("받침이 있든 없든 자판으로 치는 순서대로 늘어난다", () => {
    expect(typingSteps("가족")).toEqual(["ㄱ", "가", "가ㅈ", "가조", "가족"]);
    expect(typingSteps("친구")).toEqual(["ㅊ", "치", "친", "친ㄱ", "친구"]);
  });
});
