"use client";

import { Feedback } from "../../components/ui";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "../../lib/api";
import { loginWithGoogle } from "./session";
import { GoogleButton } from "./GoogleButton";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  const fail = useCallback((message: string) => setError(message), []);
  const signIn = useCallback(async (credential: string) => {
    setError("");
    try {
      const session = await loginWithGoogle(credential);
      router.replace(session.status === "APPROVED" ? "/dashboard" : "/application-status");
    } catch (caught) {
      if (caught instanceof ApiRequestError) setError(caught.message);
      else setError("로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
  }, [router]);

  return <div className={styles.form}>
    <GoogleButton onCredential={signIn} onError={fail} />
    {error && <Feedback tone="error">{error}</Feedback>}
  </div>;
}
