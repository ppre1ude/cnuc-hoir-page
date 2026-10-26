import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticePoll } from "./NoticePoll";

const getNoticePoll = vi.fn();
const voteNoticePoll = vi.fn();
vi.mock("./notices", () => ({
  getNoticePoll: (id: number) => getNoticePoll(id),
  voteNoticePoll: (id: number, choice: number) => voteNoticePoll(id, choice),
}));

const openPoll = {
  question: "연습에 참석하시나요?", firstOption: "참석", secondOption: "불참",
  closesAt: "2027-10-01T05:00:00Z", closed: false,
  firstCount: 0, secondCount: 0, myChoice: null,
};

describe("공지 투표", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNoticePoll.mockReset();
    voteNoticePoll.mockReset();
  });

  it("한 번 투표한 단원이 마감 전 선택을 바꾸고 새 집계를 본다", async () => {
    getNoticePoll.mockResolvedValue(openPoll);
    voteNoticePoll.mockResolvedValueOnce({ ...openPoll, firstCount: 1, myChoice: 1 })
      .mockResolvedValueOnce({ ...openPoll, secondCount: 1, myChoice: 2 });
    render(<NoticePoll noticeId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^참석/ }));
    fireEvent.click(screen.getByRole("button", { name: "투표하기" }));
    expect(await screen.findByText("내 선택: 참석")).toBeInTheDocument();
    // 내 선택은 서버 응답 전에 먼저 보이므로, 저장이 끝나 버튼 이름이 바뀔 때까지 기다립니다.
    await waitFor(() => expect(screen.getByRole("button", { name: "선택 변경" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("radio", { name: /^불참/ }));
    fireEvent.click(screen.getByRole("button", { name: "선택 변경" }));
    expect(await screen.findByText("내 선택: 불참")).toBeInTheDocument();
    await waitFor(() => expect(voteNoticePoll).toHaveBeenNthCalledWith(2, 7, 2));
    expect(screen.getByText(/1명 참여/)).toBeInTheDocument();
  });

  it("투표 전에 선택이 이름과 함께 운영진에게 보인다고 알린다", async () => {
    getNoticePoll.mockResolvedValue(openPoll);
    render(<NoticePoll noticeId={7} />);
    expect(await screen.findByText("선택은 이름과 함께 운영진에게 표시됩니다.")).toBeInTheDocument();
  });

  it("마감된 투표는 집계와 내 선택을 유지하되 변경 버튼을 숨긴다", async () => {
    getNoticePoll.mockResolvedValue({ ...openPoll, closed: true, firstCount: 1, myChoice: 1 });
    render(<NoticePoll noticeId={7} />);
    expect(await screen.findByText("내 선택: 참석")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "선택 변경" })).not.toBeInTheDocument();
    expect(voteNoticePoll).not.toHaveBeenCalled();
  });

  it("저장하는 동안 선택지를 끄지 않고, 저장 뒤 고른 선택지로 초점을 돌려준다", async () => {
    let resolve!: (value: unknown) => void;
    getNoticePoll.mockResolvedValue(openPoll);
    voteNoticePoll.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<NoticePoll noticeId={7} />);
    const radio = await screen.findByRole("radio", { name: /^참석/ });
    fireEvent.click(radio);
    const button = screen.getByRole("button", { name: "투표하기" });
    button.focus();
    fireEvent.click(button);
    expect(radio).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    resolve({ ...openPoll, firstCount: 1, myChoice: 1 });
    expect(await screen.findByText("내 선택: 참석")).toBeInTheDocument();
    expect(radio).toHaveFocus();
  });
});

describe("낙관적 집계 표시", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getNoticePoll.mockReset();
    voteNoticePoll.mockReset();
  });

  it("투표를 누르면 서버 응답 전에 집계와 내 선택이 바뀌고, 실패하면 되돌아간다", async () => {
    let reject!: (reason: unknown) => void;
    getNoticePoll.mockResolvedValue(openPoll);
    voteNoticePoll.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    render(<NoticePoll noticeId={7} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^참석/ }));
    fireEvent.click(screen.getByRole("button", { name: "투표하기" }));
    expect(screen.getByText("내 선택: 참석")).toBeInTheDocument();
    expect(screen.getByText(/1명 참여/)).toBeInTheDocument();
    reject(new Error("서버 오류"));
    expect(await screen.findByText("투표를 저장하지 못했습니다. 다시 시도해 주세요.")).toBeInTheDocument();
    // 되돌리기는 저장 작업이 끝난 뒤 그려지므로 기다립니다.
    await waitFor(() => expect(screen.queryByText("내 선택: 참석")).toBeNull());
    expect(screen.getByText(/0명 참여/)).toBeInTheDocument();
  });
});
