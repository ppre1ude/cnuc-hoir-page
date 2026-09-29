"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout } from "../../../features/auth/session";

export default function ApplicationStatusPage() {
  const router = useRouter();
  const logoutRequest = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    logoutRequest.current ??= Promise.resolve().then(logout);
    void logoutRequest.current.catch(() => {}).then(() => {
      if (active) router.replace("/login");
    });
    return () => { active = false; };
  }, [router]);

  return null;
}
