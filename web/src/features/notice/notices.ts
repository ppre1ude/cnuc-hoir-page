import { apiRequest } from "../../lib/api";

export type Notice = {
  id: number;
  title: string;
  body: string;
  author: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type NoticePage = { items: Notice[]; page: number; size: number; total: number };
export type NoticeInput = { title: string; body: string; published: boolean };

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
