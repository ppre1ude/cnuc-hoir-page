"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ActionLink, Button, Feedback } from "../../components/ui";
import { can, type Permission } from "./session";
import { useSessionState } from "./SessionProvider";
import { WaitingScore } from "./WaitingScore";
import styles from "./PageGate.module.css";

const SLOW_AFTER_MS = 3000;

// 각 라우트 페이지가 본문을 감쌉니다. 대기·느린 대기·실패·권한 없음 화면은 여기서만 그립니다.
export function PageGate({ skeleton, permission, children }: {
  skeleton: ReactNode;
  permission?: Permission;
  children: ReactNode;
}) {
  const { status, session, refresh } = useSessionState();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === "failed") {
    return <div className={styles.message}>
      <Feedback tone="error">서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</Feedback>
      <Button variant="secondary" onClick={() => { setSlow(false); refresh(); }}>다시 시도</Button>
    </div>;
  }
  if (status === "loading" || !session) {
    return <div className={styles.waiting} aria-busy="true">
      <span className={styles.srOnly} role="status">불러오는 중입니다.</span>
      {skeleton}
      {slow && <div className={styles.slow}>
        <WaitingScore />
        <p role="status">서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.</p>
      </div>}
    </div>;
  }
  if (permission && !can(session, permission)) {
    return <div className={styles.message}>
      <p>이 기능을 쓸 권한이 없습니다.</p>
      <ActionLink href="/dashboard" variant="secondary">일정으로 가기</ActionLink>
    </div>;
  }
  return children;
}
