import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventRsvp } from "./EventRsvp";
import { ApiRequestError } from "../../lib/api";

const setEventRsvp = vi.fn();
vi.mock("./events", async (importOriginal) => ({
  ...await importOriginal<typeof import("./events")>(),
  setEventRsvp: (...args: unknown[]) => setEventRsvp(...args),
}));

const event = {
  id: 7, title: "정기 연습", description: "", startAt: "2099-10-04T10:00:00Z", endAt: "2099-10-04T12:00:00Z",
  kind: "EVENT" as const, part: null, obEligible: false, publicVisible: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", cancelledAt: null,
};

describe("행사 참석 응답", () => {
  beforeEach(() => { setEventRsvp.mockReset(); });
  afterEach(cleanup);

  it("참석 응답을 저장하고 마감 전에는 불참으로 바꿀 수 있다", async () => {
    const onSaved = vi.fn();
    setEventRsvp.mockResolvedValueOnce({ eventId: 7, choice: "ATTENDING" })
      .mockResolvedValueOnce({ eventId: 7, choice: "ABSENT" });
    const view = render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "참석" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("ATTENDING"));
    view.rerender(<EventRsvp event={event} memberType="ACTIVE" choice="ATTENDING" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "불참" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("ABSENT"));
  });

  it("참여 대상이 아니거나 시작된 행사에서는 새 응답을 받지 않는다", () => {
    const onSaved = vi.fn();
    const view = render(<EventRsvp key={event.startAt} event={event} memberType="OB" choice={null} onSaved={onSaved} />);
    expect(screen.queryByRole("button", { name: "참석" })).toBeNull();
    view.rerender(<EventRsvp key="2020-10-04T10:00:00Z" event={{ ...event, startAt: "2020-10-04T10:00:00Z" }} memberType="ACTIVE" choice="ABSENT" onSaved={onSaved} />);
    expect(screen.getByLabelText("참석 응답")).toHaveTextContent("불참");
    expect(screen.getByText("응답 마감").className).toMatch(/badge/);
    expect(screen.queryByRole("button", { name: "참석" })).toBeNull();
    expect(setEventRsvp).not.toHaveBeenCalled();
  });

  it("취소된 일정에서는 응답 칸을 그리지 않는다", () => {
    render(<EventRsvp event={{ ...event, cancelledAt: "2026-09-02T00:00:00Z" }} memberType="ACTIVE" choice="ATTENDING" onSaved={vi.fn()} />);
    expect(screen.queryByLabelText("참석 응답")).toBeNull();
  });

  it("보는 사이 일정이 취소되면 시작 안내가 아니라 취소 안내를 보여 준다", async () => {
    setEventRsvp.mockRejectedValueOnce(new ApiRequestError(409, "EVENT_CANCELLED", "취소된 일정이라 참석 응답을 받지 않습니다."));
    render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "참석" }));
    expect(await screen.findByText("취소된 일정이라 응답을 받지 않습니다.")).toBeInTheDocument();
  });
});

describe("참석 응답 표시", () => {
  beforeEach(() => { setEventRsvp.mockReset(); });
  afterEach(cleanup);
  it("저장하는 동안 누른 버튼을 끄지 않아 초점을 지키고 다시 눌러도 한 번만 보낸다", async () => {
    let resolve!: (value: unknown) => void;
    setEventRsvp.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={vi.fn()} />);
    const button = screen.getByRole("button", { name: "참석" });
    button.focus();
    fireEvent.click(button);
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(setEventRsvp).toHaveBeenCalledTimes(1);
    resolve({ eventId: 7, choice: "ATTENDING" });
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"));
  });
});

describe("낙관적 응답 표시", () => {
  beforeEach(() => { setEventRsvp.mockReset(); });
  afterEach(cleanup);

  it("응답을 누르면 서버 응답 전에 배지가 바뀌고, 실패하면 이전 값으로 돌아간다", async () => {
    let reject!: (reason: unknown) => void;
    setEventRsvp.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    render(<EventRsvp event={event} memberType="ACTIVE" choice={null} onSaved={vi.fn()} />);
    const button = screen.getByRole("button", { name: "참석" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("미응답")).toBeNull();
    reject(new Error("서버 오류"));
    expect(await screen.findByText("응답을 저장하지 못했습니다. 다시 시도해 주세요.")).toBeInTheDocument();
    // 되돌리기는 저장 작업이 끝난 뒤 그려지므로 기다립니다.
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText("미응답")).toBeInTheDocument();
  });
});
