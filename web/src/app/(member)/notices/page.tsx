import { NoticeList } from "../../../features/notice/NoticeList";

export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const { notice } = await searchParams;
  const id = typeof notice === "string" ? Number(notice) : NaN;
  const initialNoticeId = Number.isSafeInteger(id) && id > 0 ? id : null;
  return <NoticeList key={initialNoticeId ?? "list"} initialNoticeId={initialNoticeId} />;
}
