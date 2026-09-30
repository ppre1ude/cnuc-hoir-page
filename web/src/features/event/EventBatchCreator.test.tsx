import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBatchCreator } from "./EventBatchCreator";

const createEventsBatch = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  createEventsBatch: (...args: unknown[]) => createEventsBatch(...args),
}));

describe("운영진 월간 일정 등록", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-30T00:00:00Z"));
    createEventsBatch.mockReset().mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("선택한 여러 날짜를 한 번의 요청으로 등록하고 해당 월 목록을 새로고침한다", async () => {
    const onCreated = vi.fn();
    render(<EventBatchCreator onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "2026-10" } });
    fireEvent.click(screen.getByRole("button", { name: "4일" }));
    fireEvent.click(screen.getByRole("button", { name: "11일" }));
    fireEvent.change(screen.getByLabelText("공통 시작 시각 (한국 시간)"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByLabelText("공통 종료 시각 (한국 시간)"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "2개 일정 등록" }));
    await waitFor(() => expect(createEventsBatch).toHaveBeenCalledTimes(1));
    expect(createEventsBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({ title: "정기 연습", description: "", startAt: "2026-10-04T10:00:00.000Z", endAt: "2026-10-04T12:00:00.000Z" }),
      expect.objectContaining({ title: "정기 연습", description: "", startAt: "2026-10-11T10:00:00.000Z", endAt: "2026-10-11T12:00:00.000Z" }),
    ]);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("2026-10"));
  });
});
