import { apiRequest } from "../../lib/api";

export type Application = { email: string; password: string; name: string };

export function applyForMembership(application: Application): Promise<void> {
  return apiRequest<void>("/auth/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
}

export function verifyEmail(token: string): Promise<void> {
  return apiRequest<void>("/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string): Promise<void> {
  return apiRequest<void>("/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
