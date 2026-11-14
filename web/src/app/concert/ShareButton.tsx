"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** 휴대폰에서는 공유 창을 띄우고, 공유 창이 없는 브라우저에서는 주소를 복사합니다. */
export function ShareButton({ title, text, className }: { title: string; text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // 공유 창을 닫았거나 복사가 막힌 경우입니다. 주소창의 주소를 그대로 쓸 수 있으니 따로 알리지 않습니다.
    }
  }

  return (
    <Button variant="unstyled" className={className} onClick={share}>
      <span aria-live="polite">{copied ? "주소를 복사했어요" : "친구에게 공유하기"}</span>
    </Button>
  );
}
