import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoticeEdit } from "./NoticeEdit";
import { getAdminNotice, getAdminNoticePoll, updateNotice, type AdminPollView, type Notice } from "./notices";
import { ApiRequestError } from "../../lib/api";
import { nav } from "../../test/navigation";
import { renderWithSession, sessionFixture } from "../../test/session";

vi.mock("./notices", () => ({ getAdminNotice: vi.fn(), getAdminNoticePoll: vi.fn(), updateNotice: vi.fn(), createNotice: vi.fn() }));
vi.mock("next/navigation", () => import("../../test/navigation"));

const staff = sessionFixture({ permissions: ["MANAGE_EVENTS"] });
const notice = (published: boolean): Notice => ({ id: 5, title: "연주회 안내", body: "12월 1일", author: "운영진", published,
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z", publishedAt: published ? "2026-10-02T00:00:00Z" : null });
const pollView: AdminPollView = { poll: { question: "오시나요?", firstOption: "참석", secondOption: "불참", closesAt: "2026-12-01T09:00:00Z", closed: false, firstCount: 2, secondCount: 1, myChoice: null },
  respondents: [{ memberId: 2, name: "김하늘", part: "SOPRANO", cohort: 5, choice: 1, updatedAt: "2026-10-03T00:00:00Z" }] };
const noPoll = () => vi.mocked(getAdminNoticePoll).mockRejectedValue(new ApiRequestError(404, "POLL_NOT_FOUND", "없음"));

beforeEach(() => {
  nav.reset();
  nav.pathname = "/admin/notices/5";
  vi.mocked(getAdminNotice).mockResolvedValue(notice(false));
  noPoll();
  vi.mocked(updateNotice).mockImplementation(async (_id, input) => ({ ...notice(input.published), title: input.title, body: input.body,
    publishedAt: input.published ? "2026-11-03T00:00:00Z" : null }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("초안 공지는 저장과 게시하기 버튼을, 게시 공지는 저장과 초안으로 내리기를 보입니다", async () => {
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  expect(await screen.findByRole("button", { name: "게시하기" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  expect(screen.getByText("초안")).toBeInTheDocument();
  cleanup();
  vi.mocked(getAdminNotice).mockResolvedValue(notice(true));
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  expect(await screen.findByRole("button", { name: "초안으로 내리기" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  expect(screen.getByText("게시")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "게시하기" })).not.toBeInTheDocument();
});

test("게시하기는 published true로 보내고 머물면서 게시했습니다를 알리고 배지를 바꿉니다", async () => {
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  await userEvent.type(await screen.findByLabelText("제목"), " 수정");
  await userEvent.click(screen.getByRole("button", { name: "게시하기" }));
  expect(updateNotice).toHaveBeenLastCalledWith(5, { title: "연주회 안내 수정", body: "12월 1일", published: true });
  expect(await screen.findByText("게시했습니다.")).toBeInTheDocument();
  expect(screen.getByText("게시")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "초안으로 내리기" })).toBeInTheDocument();
  expect(nav.pushed).toHaveLength(0);
});

test("초안으로 내리기는 확인 창을 취소하면 보내지 않고, 확인하면 false로 보냅니다", async () => {
  vi.mocked(getAdminNotice).mockResolvedValue(notice(true));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  await userEvent.click(await screen.findByRole("button", { name: "초안으로 내리기" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("초안으로 내리면 단원에게 보이지 않습니다"));
  expect(updateNotice).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await userEvent.click(screen.getByRole("button", { name: "초안으로 내리기" }));
  expect(updateNotice).toHaveBeenLastCalledWith(5, { title: "연주회 안내", body: "12월 1일", published: false });
  expect(await screen.findByText("초안으로 내렸습니다.")).toBeInTheDocument();
  confirm.mockRestore();
});

test("투표가 있으면 결과와 응답자 명단을 보이고 투표 묶음은 없습니다", async () => {
  vi.mocked(getAdminNoticePoll).mockResolvedValue(pollView);
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  const results = await screen.findByRole("region", { name: "투표 결과" });
  expect(results).toHaveTextContent("오시나요?");
  expect(results).toHaveTextContent("참석 2명, 불참 1명");
  expect(results).toHaveTextContent("김하늘");
  expect(screen.queryByRole("group", { name: "투표" })).not.toBeInTheDocument();
});

test("투표가 없으면 투표 묶음으로 붙일 수 있고 저장에 함께 보냅니다", async () => {
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  await userEvent.click(await screen.findByRole("button", { name: "찬성 / 반대" }));
  await userEvent.type(screen.getByLabelText("질문"), "찬성?");
  await userEvent.type(screen.getByLabelText("마감 시각 (한국 시간)"), "2026-12-01T18:00");
  await userEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(updateNotice).toHaveBeenLastCalledWith(5, { title: "연주회 안내", body: "12월 1일", published: false,
    poll: { question: "찬성?", firstOption: "찬성", secondOption: "반대", closesAt: "2026-12-01T09:00:00.000Z" } });
  expect(await screen.findByText("저장했습니다.")).toBeInTheDocument();
});

test("공지가 없으면 안내와 들어온 쪽으로 가는 공지 관리 링크를 보입니다", async () => {
  nav.search = "page=3";
  vi.mocked(getAdminNotice).mockRejectedValue(new ApiRequestError(404, "NOTICE_NOT_FOUND", "공지를 찾을 수 없습니다."));
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  expect(await screen.findByRole("alert")).toHaveTextContent("공지를 찾을 수 없습니다.");
  expect(screen.getByRole("link", { name: "공지 관리로" })).toHaveAttribute("href", "/admin/notices?page=3");
});

test("돌아가기 링크는 들어온 쪽을 유지합니다", async () => {
  nav.search = "page=3";
  renderWithSession(<NoticeEdit noticeId={5} />, staff);
  expect(await screen.findByRole("link", { name: "← 공지 관리로" })).toHaveAttribute("href", "/admin/notices?page=3");
  await waitFor(() => expect(getAdminNotice).toHaveBeenCalledWith(5));
});
