import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBatchCreator } from "./EventBatchCreator";
import { ApiRequestError } from "../../lib/api";

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
      expect.objectContaining({ title: "전체연습", description: "", startAt: "2026-10-04T10:00:00.000Z", endAt: "2026-10-04T12:00:00.000Z" }),
      expect.objectContaining({ title: "전체연습", description: "", startAt: "2026-10-11T10:00:00.000Z", endAt: "2026-10-11T12:00:00.000Z" }),
    ]);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("2026-10"));
  });

  it("월을 지우면 날짜를 고를 수 없고 등록 버튼도 꺼진다", () => {
    render(<EventBatchCreator onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "4일" }));
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "4일" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0개 일정 등록" })).toBeDisabled();
  });

  it("서버가 알려 준 중복 일정 안내를 그대로 보여 준다", async () => {
    const message = "2026년 10월 4일 19:00에 시작하는 일정이 이미 있습니다. 그 날짜를 빼고 다시 등록해 주세요.";
    createEventsBatch.mockRejectedValue(new ApiRequestError(409, "DUPLICATE_EVENT_TIME", message));
    const onCreated = vi.fn();
    render(<EventBatchCreator onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("월"), { target: { value: "2026-10" } });
    fireEvent.click(screen.getByRole("button", { name: "4일" }));
    fireEvent.change(screen.getByLabelText("공통 시작 시각 (한국 시간)"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByLabelText("공통 종료 시각 (한국 시간)"), { target: { value: "21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "1개 일정 등록" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
