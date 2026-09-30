import { apiRequest } from "../../lib/api";

export type MemberSession = {
  id: number;
  name: string;
  status: "INVITED" | "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
};

export function loginWithGoogle(credential: string): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function getSession(): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/me");
}

export function completeAccountSetup(token: string, credential: string): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/account-setup/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, credential }),
  });
}
