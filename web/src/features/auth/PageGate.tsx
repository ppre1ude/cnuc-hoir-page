"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ActionLink, Button, Feedback } from "../../components/ui";
import { can, type Permission } from "./session";
import { useSessionState } from "./SessionProvider";
import { WaitingScore } from "./WaitingScore";
import styles from "./PageGate.module.css";

const SLOW_AFTER_MS = 3000;
const SLOW_MESSAGE = "서버를 깨우고 있습니다. 오랜만에 접속하면 1분 정도 걸릴 수 있어요.";

// 각 라우트 페이지가 본문을 감쌉니다. 대기·느린 대기·실패·권한 없음 화면은 여기서만 그립니다.
export function PageGate({ skeleton, permission, children }: {
  skeleton: ReactNode;
  permission?: Permission;
  children: ReactNode;
}) {
  const { status, session, refresh } = useSessionState();
  const [slow, setSlow] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === "failed") {
    return <div className={styles.message}>
      <Feedback tone="error">서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</Feedback>
      {/* 다시 시도가 또 실패하면 새로 그린 버튼으로 포커스를 돌려줍니다. */}
      <Button variant="secondary" autoFocus={retried} onClick={() => { setSlow(false); setRetried(true); refresh(); }}>다시 시도</Button>
    </div>;
  }
  if (status === "loading" || !session) {
    // 알림 영역은 대기 내내 한 개만 두고 글자만 바꿔야 화면 읽기 프로그램이 3초 뒤 안내를 놓치지 않습니다.
    return <div className={styles.waiting}>
      <span className={styles.srOnly} role="status">{slow ? SLOW_MESSAGE : "불러오는 중입니다."}</span>
      {skeleton}
      {slow && <div className={styles.slow}>
        <WaitingScore />
        <p>{SLOW_MESSAGE}</p>
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
