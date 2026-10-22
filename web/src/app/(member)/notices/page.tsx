import type { Metadata } from "next";
import { PageGate } from "../../../features/auth/PageGate";
import { NoticeList } from "../../../features/notice/NoticeList";
import { NoticeListSkeleton } from "../../../features/notice/NoticeListSkeleton";

export const metadata: Metadata = { title: "공지" };

export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const { notice } = await searchParams;
  const id = typeof notice === "string" ? Number(notice) : NaN;
  const initialNoticeId = Number.isSafeInteger(id) && id > 0 ? id : null;
  return <PageGate skeleton={<NoticeListSkeleton />}>
    <NoticeList key={initialNoticeId ?? "list"} initialNoticeId={initialNoticeId} />
  </PageGate>;
}
