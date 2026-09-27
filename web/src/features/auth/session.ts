import { apiRequest } from "../../lib/api";

export type MemberSession = {
  id: number;
  name: string;
  status: "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
};

export function login(email: string, password: string): Promise<void> {
  return apiRequest<void>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function getSession(): Promise<MemberSession> {
  return apiRequest<MemberSession>("/auth/me");
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiRequest<void>("/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return apiRequest<void>("/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}
