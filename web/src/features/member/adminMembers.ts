import { apiRequest } from "../../lib/api";
import type { Department, MemberRoleItem, Part, Role, Unit } from "../auth/session";

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

export function cancelRejection(id: number): Promise<void> {
  return apiRequest<void>(`/admin/applications/${id}/cancel-rejection`, { method: "POST" });
}

export function revokeMember(id: number, reason: string): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/revoke`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
  });
}

export type MemberItem = {
  id: number;
  name: string;
  email: string | null;
  status: "INVITED" | "EMAIL_PENDING" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  memberType: "ACTIVE" | "OB" | null;
  admin: boolean;
  googleLinked: boolean;
  createdAt: string;
  part: Part | null;
  cohort: number | null;
  roles: MemberRoleItem[];
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

export type AllowlistItem = {
  id: number;
  email: string;
  memberType: "ACTIVE" | "OB";
  name: string | null;
  createdAt: string;
};

export type AllowlistPage = { items: AllowlistItem[]; page: number; size: number; total: number };

export function getAllowlist(page = 0): Promise<AllowlistPage> {
  return apiRequest<AllowlistPage>(`/admin/allowlist?page=${page}&size=20`);
}

export function addAllowlist(input: { email: string; memberType: "ACTIVE" | "OB"; name?: string }): Promise<AllowlistItem> {
  return apiRequest<AllowlistItem>("/admin/allowlist", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function removeAllowlist(id: number): Promise<void> {
  return apiRequest<void>(`/admin/allowlist/${id}`, { method: "DELETE" });
}

export type OperatorPreapprovalItem = {
  id: number;
  email: string;
  memberType: "ACTIVE" | "OB";
  createdAt: string;
};

export type OperatorPreapprovalPage = {
  items: OperatorPreapprovalItem[];
  page: number;
  size: number;
  total: number;
};

export function getOperatorPreapprovals(page = 0): Promise<OperatorPreapprovalPage> {
  return apiRequest<OperatorPreapprovalPage>(`/admin/operator-preapprovals?page=${page}&size=20`);
}

export function addOperatorPreapproval(input: {
  email: string;
  memberType: "ACTIVE" | "OB";
}): Promise<OperatorPreapprovalItem> {
  return apiRequest<OperatorPreapprovalItem>("/admin/operator-preapprovals", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function removeOperatorPreapproval(id: number): Promise<void> {
  return apiRequest<void>(`/admin/operator-preapprovals/${id}`, { method: "DELETE" });
}

export function updateMemberProfile(id: number, input: { part: Part | null; cohort: number | null }): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/profile`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function assignMemberRole(id: number, input: { role: Role; department?: Department; unit?: Unit; part?: Part }): Promise<MemberRoleItem> {
  return apiRequest<MemberRoleItem>(`/admin/members/${id}/roles`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export function removeMemberRole(id: number, roleId: number): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/roles/${roleId}`, { method: "DELETE" });
}

export function setSiteAdmin(id: number, admin: boolean): Promise<void> {
  return apiRequest<void>(`/admin/members/${id}/site-admin`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin }),
  });
}
