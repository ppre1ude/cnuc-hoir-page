"use client";

import { ActionLink, Button, Feedback, PageHeader } from "../components/ui";
import styles from "../components/ui/ui.module.css";

// 라우트 안에서 그리다 난 예외를 잡는 마지막 울타리입니다. API 실패와 세션 실패는 PageGate가 먼저 처리합니다.
// 회원·운영진 그룹은 이 파일을 다시 내보내 상단 메뉴를 남긴 채 본문만 바꿉니다.
export default function RouteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main id="member-content" tabIndex={-1} className={styles.screen}>
    <PageHeader title="문제가 생겼습니다" />
    <Feedback tone="error">화면을 그리는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.</Feedback>
    <div className={styles.actions}>
      <Button variant="primary" autoFocus onClick={retry}>다시 시도</Button>
      <ActionLink variant="secondary" href="/">홈으로 가기</ActionLink>
    </div>
  </main>;
}
