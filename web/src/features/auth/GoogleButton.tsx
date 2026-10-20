"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { ActionLink, Button, Feedback } from "../../components/ui";
import { detectInAppBrowser, openExternally } from "./inAppBrowser";
import { getGoogleNonce } from "./session";
import { SLOW_AFTER_MS, SLOW_MESSAGE, WaitingScore } from "./WaitingScore";

type GoogleCredential = { credential: string };
type GoogleAccounts = {
  id: {
    initialize: (options: { client_id: string; nonce: string; callback: (response: GoogleCredential) => void }) => void;
    renderButton: (element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; width: number; text: "signin_with" }) => void;
  };
};

declare global {
  interface Window { google?: { accounts: GoogleAccounts } }
}

// 준비 중이면 대기 안내, 서버에서 준비값을 받지 못하면 다시 시도 버튼을 보입니다. 구글 스크립트를 못 받으면 안내를 멈추고 부모에게 알립니다.
type Phase = "preparing" | "ready" | "failed" | "stopped";

const neverChanges = () => () => {};

export function GoogleButton({ onCredential, onError, reopenUrl }: {
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
  reopenUrl?: string;
}) {
  const target = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const preparation = useRef(0);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [slow, setSlow] = useState(false);
  const [retried, setRetried] = useState(false);
  const opened = useRef(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const userAgent = useSyncExternalStore(neverChanges, () => navigator.userAgent, () => "");
  const browser = detectInAppBrowser(userAgent);
  const reopenHref = browser?.reopen ? browser.reopen(reopenUrl ?? window.location.href) : null;

  useEffect(() => {
    if (!reopenHref || opened.current) return;
    opened.current = true;
    openExternally(reopenHref);
  }, [reopenHref]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; preparation.current += 1; };
  }, []);

  useEffect(() => {
    if (phase !== "preparing") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  async function ready() {
    const request = ++preparation.current;
    if (!clientId || !mounted.current || !window.google || !target.current) return;
    const current = () => mounted.current && request === preparation.current;
    try {
      // 잠든 서버가 깨어나는 사이 첫 요청이 중계에서 끊기는 경우가 있어 한 번 더 받습니다.
      const { nonce } = await getGoogleNonce().catch((error: unknown) => {
        if (!current()) throw error;
        return getGoogleNonce();
      });
      if (!current() || !target.current) return;
      target.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: (response) => {
          if (!current() || busy.current || !response.credential) return;
          busy.current = true;
          void onCredential(response.credential).catch(() => {
            if (current()) onError("구글 로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
          }).finally(() => {
            busy.current = false;
            if (current()) void ready();
          });
        },
      });
      window.google.accounts.id.renderButton(target.current, {
        type: "standard", theme: "outline", size: "large", width: 320, text: "signin_with",
      });
      setPhase("ready");
    } catch {
      if (current()) setPhase("failed");
    }
  }

  function retry() {
    setSlow(false);
    setRetried(true);
    setPhase("preparing");
    void ready();
  }

  // 감지가 틀릴 수도 있어 안내만 덧붙이고 구글 버튼은 그대로 둡니다.
  const notice = browser && <>
    <Feedback tone="error">{browser.name} 안에서는 구글 로그인이 막힐 수 있습니다. 다른 브라우저에서 열어 주세요.</Feedback>
    {reopenHref ? <>
      <div><ActionLink href={reopenHref}>다른 브라우저로 열기</ActionLink></div>
      <p>버튼이 안 되면 메뉴에서 &apos;다른 브라우저로 열기&apos;를 눌러 주세요.</p>
    </> : <p>메뉴에서 &apos;외부 브라우저로 열기&apos;를 눌러 주세요.</p>}
  </>;

  if (!clientId) return <>{notice}<p role="alert">구글 로그인 설정이 필요합니다. 운영진에게 알려 주세요.</p></>;
  return <>
    {notice}
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"
      onReady={() => { void ready(); }}
      onError={() => {
        if (!mounted.current) return;
        setPhase("stopped");
        onError("구글 로그인 화면을 불러오지 못했습니다.");
      }} />
    <div ref={target} aria-label="구글 로그인" />
    <p>구글 창이 열리지 않거나, 닫히거나, 오류가 보이면 버튼을 다시 눌러 주세요. 계속 안 되면 운영진에게 알려 주세요.</p>
    {phase === "preparing" && slow && <WaitingScore />}
    {/* 알림 영역은 대기 내내 한 개만 두고 글자만 바꿔야 화면 읽기 프로그램이 3초 뒤 안내를 놓치지 않습니다. */}
    {phase === "preparing" && <p role="status">{slow ? SLOW_MESSAGE : "구글 로그인 준비 중..."}</p>}
    {phase === "failed" && <>
      <Feedback tone="error">서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</Feedback>
      {/* div로 감싸 세로 배치에서 버튼이 가로로 늘어나지 않게 합니다. 다시 시도가 또 실패하면 새로 그린 버튼으로 포커스를 돌려줍니다. */}
      <div><Button variant="secondary" autoFocus={retried} onClick={retry}>다시 시도</Button></div>
    </>}
  </>;
}
