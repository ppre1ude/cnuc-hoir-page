import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeEditor } from "./NoticeEditor";
import { ApiRequestError } from "../../lib/api";
import { renderWithSession, sessionFixture } from "../../test/session";

const getAdminNotices = vi.fn();
const createNotice = vi.fn();
const updateNotice = vi.fn();
const getAdminNoticePoll = vi.fn();
vi.mock("./notices", () => ({
  getAdminNotices: (page: number) => getAdminNotices(page),
  createNotice: (input: unknown) => createNotice(input),
  updateNotice: (id: number, input: unknown) => updateNotice(id, input),
  getAdminNoticePoll: (id: number) => getAdminNoticePoll(id),
}));

describe("공지 편집기", () => {
  afterEach(cleanup);
  beforeEach(() => {
    getAdminNotices.mockReset();
    createNotice.mockReset();
    updateNotice.mockReset();
    getAdminNoticePoll.mockReset();
    getAdminNoticePoll.mockRejectedValue(new ApiRequestError(404, "POLL_NOT_FOUND", "투표가 없습니다."));
    createNotice.mockResolvedValue({ id: 2 });
  });

  it("저장 성공 뒤 목록 조회 실패를 저장 실패로 표시하지 않고 재시도한다", async () => {
    getAdminNotices.mockResolvedValueOnce({ items: [], page: 0, size: 20, total: 0 })
      .mockRejectedValueOnce(new Error("목록 오류"))
      .mockResolvedValueOnce({ items: [{ id: 2, title: "새 공지", body: "본문", published: false }], page: 0, size: 20, total: 1 });
    renderWithSession(<NoticeEditor />, sessionFixture({ admin: true }));
    await screen.findByText("작성된 공지가 없습니다.");
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 공지" } });
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "본문" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공지는 저장됐지만 목록을 새로고침하지 못했습니다.");
    expect(screen.queryByText("공지를 저장하지 못했습니다.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveValue("");
    expect(createNotice).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: /새 공지\s*초안/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(createNotice).toHaveBeenCalledTimes(1);
  });

  it("수정 성공 뒤 목록 조회 실패도 수정 실패로 표시하지 않는다", async () => {
    updateNotice.mockResolvedValue({ id: 1 });
    getAdminNotices.mockResolvedValueOnce({
      items: [{ id: 1, title: "기존 공지", body: "이전 본문", published: false }], page: 0, size: 20, total: 1,
    }).mockRejectedValueOnce(new Error("목록 오류"));
    renderWithSession(<NoticeEditor />, sessionFixture({ admin: true }));
    fireEvent.click(await screen.findByRole("button", { name: /기존 공지\s*초안/ }));
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "수정 본문" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공지는 저장됐지만 목록을 새로고침하지 못했습니다.");
    expect(updateNotice).toHaveBeenCalledWith(1, { title: "기존 공지", body: "수정 본문", published: false });
    expect(updateNotice).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("본문")).toHaveValue("");
  });

  it("페이지 조회 실패 시 이전 페이지를 숨기고 재시도 성공 뒤 오류를 지운다", async () => {
    getAdminNotices.mockImplementation((page: number) => page === 0
      ? Promise.resolve({ items: [{ id: 1, title: "첫 공지", body: "본문", published: true }], page, size: 1, total: 2 })
      : getAdminNotices.mock.calls.filter(([requested]) => requested === 1).length === 1
        ? Promise.reject(new Error("목록 오류"))
        : Promise.resolve({ items: [{ id: 2, title: "다음 공지", body: "본문", published: false }], page, size: 1, total: 2 }));
    renderWithSession(<NoticeEditor />, sessionFixture({ admin: true }));
    await screen.findByRole("button", { name: /첫 공지\s*게시/ });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("공지 목록을 불러오지 못했습니다.");
    expect(screen.queryByRole("button", { name: /첫 공지\s*게시/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: /다음 공지\s*초안/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("공지와 참석 여부 투표를 한 번에 등록한다", async () => {
    getAdminNotices.mockResolvedValue({ items: [], page: 0, size: 20, total: 0 });
    renderWithSession(<NoticeEditor />, sessionFixture({ admin: true }));
    await screen.findByText("작성된 공지가 없습니다.");
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "연습 참여 조사" } });
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "참석 여부를 선택해 주세요." } });
    fireEvent.click(screen.getByLabelText("투표 추가"));
    fireEvent.change(screen.getByLabelText("질문"), { target: { value: "연습에 참석하시나요?" } });
    fireEvent.change(screen.getByLabelText("마감 시각 (한국 시간)"), { target: { value: "2027-10-01T14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(createNotice).toHaveBeenCalledWith({
      title: "연습 참여 조사", body: "참석 여부를 선택해 주세요.", published: false,
      poll: { question: "연습에 참석하시나요?", firstOption: "참석", secondOption: "불참",
        closesAt: "2027-10-01T05:00:00.000Z" },
    }));
  });
});
