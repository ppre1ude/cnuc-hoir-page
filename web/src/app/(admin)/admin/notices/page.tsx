import type { Metadata } from "next";
import { PageGate } from "../../../../features/auth/PageGate";
import { NoticeEditor } from "../../../../features/notice/NoticeEditor";
import { NoticeEditorSkeleton } from "../../../../features/notice/NoticeEditorSkeleton";

export const metadata: Metadata = { title: "공지 관리" };

export default function AdminNoticesPage() {
  return <main>
    <PageGate skeleton={<NoticeEditorSkeleton />} permission="MANAGE_EVENTS"><NoticeEditor /></PageGate>
  </main>;
}
