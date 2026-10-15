import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouteJourney } from "./RouteJourney";

afterEach(cleanup);

describe("RouteJourney", () => {
  it("네 문장과 무대 사진을 처음부터 읽을 수 있다", () => {
    render(<RouteJourney />);
    const section = screen.getByRole("region", { name: "합창단의 가치" });
    expect(section).toHaveTextContent("내 목소리를 알아가고,");
    expect(section).toHaveTextContent("나를 발견하고,");
    expect(section).toHaveTextContent("함께 노래하며");
    expect(section).toHaveTextContent("우리가 됩니다.");
    expect(screen.getByRole("img", { name: "지휘자와 단원들이 무대에서 합창하는 모습" })).toBeInTheDocument();
  });

  it("경로 길이 계산을 할 수 없는 환경에서는 완성 상태를 유지한다", () => {
    render(<RouteJourney />);
    expect(screen.getByRole("region", { name: "합창단의 가치" })).not.toHaveAttribute("data-ready");
  });
});
