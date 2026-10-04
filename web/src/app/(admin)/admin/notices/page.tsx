import { PageGate } from "../../../../features/auth/PageGate";
import { NoticeEditor } from "../../../../features/notice/NoticeEditor";
import { NoticeEditorSkeleton } from "../../../../features/notice/NoticeEditorSkeleton";

export default function AdminNoticesPage() {
  return <main>
    <PageGate skeleton={<NoticeEditorSkeleton />} permission="MANAGE_EVENTS"><NoticeEditor /></PageGate>
  </main>;
}
