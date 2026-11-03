import type { Metadata } from "next";
import { PageGate } from "../../../../../features/auth/PageGate";
import { NoticeEdit } from "../../../../../features/notice/NoticeEdit";
import { NoticeFormSkeleton } from "../../../../../features/notice/NoticeFormSkeleton";

export const metadata: Metadata = { title: "공지 수정" };

export default async function Page({ params }: PageProps<"/admin/notices/[id]">) {
  const noticeId = Number((await params).id);
  return <main>
    {Number.isSafeInteger(noticeId) && noticeId > 0
      ? <PageGate skeleton={<NoticeFormSkeleton />} permission="MANAGE_EVENTS"><NoticeEdit noticeId={noticeId} /></PageGate>
      : <p>공지 주소를 확인해 주세요.</p>}
  </main>;
}
