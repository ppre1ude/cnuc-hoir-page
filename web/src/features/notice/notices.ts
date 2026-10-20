import { apiRequest } from "../../lib/api";
import type { Part } from "../auth/session";

export type Notice = {
  id: number;
  title: string;
  body: string;
  author: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  poll?: PollSummary | null;
};

export type NoticePage = { items: Notice[]; page: number; size: number; total: number };
export type PollInput = {
  question: string;
  firstOption: string;
  secondOption: string;
  closesAt: string;
};
export type PollView = PollInput & {
  closed: boolean;
  firstCount: number;
  secondCount: number;
  myChoice: number | null;
};
export type PollSummary = Pick<PollView, "firstOption" | "secondOption" | "closesAt" | "closed" | "myChoice">;
export type PollRespondent = {
  memberId: number;
  name: string;
  part: Part | null;
  cohort: number | null;
  choice: number;
  updatedAt: string;
};
export type AdminPollView = { poll: PollView; respondents: PollRespondent[] };
export type NoticeInput = { title: string; body: string; published: boolean; poll?: PollInput };

export function getNotices(page = 0): Promise<NoticePage> {
  return apiRequest<NoticePage>(`/notices?page=${page}&size=20`);
}

export function getNotice(id: number): Promise<Notice> {
  return apiRequest<Notice>(`/notices/${id}`);
}

export function getAdminNotices(page = 0): Promise<NoticePage> {
  return apiRequest<NoticePage>(`/admin/notices?page=${page}&size=20`);
}

export function createNotice(input: NoticeInput): Promise<Notice> {
  return apiRequest<Notice>("/admin/notices", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function updateNotice(id: number, input: NoticeInput): Promise<Notice> {
  return apiRequest<Notice>(`/admin/notices/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function getNoticePoll(id: number): Promise<PollView> {
  return apiRequest<PollView>(`/notices/${id}/poll`);
}

export function voteNoticePoll(id: number, choice: number): Promise<PollView> {
  return apiRequest<PollView>(`/notices/${id}/poll/vote`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }),
  });
}

export function getAdminNoticePoll(id: number): Promise<AdminPollView> {
  return apiRequest<AdminPollView>(`/admin/notices/${id}/poll`);
}
