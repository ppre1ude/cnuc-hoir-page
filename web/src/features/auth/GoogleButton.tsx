"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";

type GoogleCredential = { credential: string };
type GoogleAccounts = {
  id: {
    initialize: (options: { client_id: string; callback: (response: GoogleCredential) => void }) => void;
    renderButton: (element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; width: number; text: "signin_with" }) => void;
  };
};

declare global {
  interface Window { google?: { accounts: GoogleAccounts } }
}

export function GoogleButton({ onCredential, onError }: {
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const ready = useCallback(() => {
    if (!clientId || !window.google || !target.current) return;
    target.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (busy.current || !response.credential) return;
        busy.current = true;
        void onCredential(response.credential).catch(() => {
          onError("구글 로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
        }).finally(() => { busy.current = false; });
      },
    });
    window.google.accounts.id.renderButton(target.current, {
      type: "standard", theme: "outline", size: "large", width: 320, text: "signin_with",
    });
    setLoaded(true);
  }, [clientId, onCredential, onError]);

  if (!clientId) return <p role="alert">구글 로그인 설정이 필요합니다. 운영진에게 알려 주세요.</p>;
  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={ready}
      onError={() => onError("구글 로그인 화면을 불러오지 못했습니다.")} />
    <div ref={target} aria-label="구글 로그인" />
    {!loaded && <p role="status">구글 로그인 준비 중...</p>}
  </>;
}
