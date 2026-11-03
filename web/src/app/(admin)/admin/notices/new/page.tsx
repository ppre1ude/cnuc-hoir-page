import type { Metadata } from "next";
import { PageGate } from "../../../../../features/auth/PageGate";
import { NoticeForm } from "../../../../../features/notice/NoticeForm";
import { NoticeFormSkeleton } from "../../../../../features/notice/NoticeFormSkeleton";

export const metadata: Metadata = { title: "새 공지 작성" };

export default function NewNoticePage() {
  return <main>
    <PageGate skeleton={<NoticeFormSkeleton />} permission="MANAGE_EVENTS"><NoticeForm mode="new" /></PageGate>
  </main>;
}
