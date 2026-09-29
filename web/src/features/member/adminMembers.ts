import { apiRequest } from "../../lib/api";

export type ApplicationItem = {
  id: number;
  name: string;
  email: string;
  status: "APPROVAL_PENDING";
  createdAt: string;
};

export type ApplicationPage = { items: ApplicationItem[]; page: number; size: number; total: number };

export function getApplications(page = 0): Promise<ApplicationPage> {
  return apiRequest<ApplicationPage>(`/admin/applications?status=APPROVAL_PENDING&page=${page}&size=20`);
}

export function approveApplication(id: number, memberType: "ACTIVE" | "OB"): Promise<void> {
  return apiRequest<void>(`/admin/applications/${id}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberType }),
  });
}

export function rejectApplication(id: number, reason: string): Promise<void> {
  return apiRequest<void>(`/admin/applications/${id}/reject`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
  });
}

export function revokeMember(id: number, reason: string): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/revoke`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
  });
}

export type MemberItem = {
  id: number;
  name: string;
  email: string;
  status: "INVITED" | "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
  createdAt: string;
};

export type MemberPage = { items: MemberItem[]; page: number; size: number; total: number };
export type IssuedInvitation = { memberId: number; token: string };

export function getMembers(page = 0): Promise<MemberPage> {
  return apiRequest<MemberPage>(`/admin/members?page=${page}&size=20`);
}

export function inviteMember(input: { name: string; email: string; memberType: "ACTIVE" | "OB" }): Promise<IssuedInvitation> {
  return apiRequest<IssuedInvitation>("/admin/members/invitations", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function reissueAccountSetup(id: number): Promise<IssuedInvitation> {
  return apiRequest<IssuedInvitation>(`/admin/members/${id}/account-setup`, { method: "POST" });
}
