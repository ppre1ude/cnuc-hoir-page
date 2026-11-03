import type { Metadata } from "next";
import { Suspense } from "react";
import { PageGate } from "../../../../features/auth/PageGate";
import { NoticeManager } from "../../../../features/notice/NoticeManager";
import { NoticeManagerSkeleton } from "../../../../features/notice/NoticeManagerSkeleton";

export const metadata: Metadata = { title: "공지 관리" };

// 목록은 ?page=를 읽으므로(useSearchParams) 정적으로 그리는 이 라우트에서는 Suspense로 감쌉니다.
export default function AdminNoticesPage() {
  return <main>
    <PageGate skeleton={<NoticeManagerSkeleton />} permission="MANAGE_EVENTS">
      <Suspense fallback={<NoticeManagerSkeleton />}><NoticeManager /></Suspense>
    </PageGate>
  </main>;
}
