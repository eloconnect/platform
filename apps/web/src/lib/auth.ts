import type { AuthenticatedUser } from "@eloconnect/shared";

export interface MemberOverview {
  associate: {
    id: string;
    legalName: string;
    tradeName: string | null;
    status:
      "ADIMPLENTE" | "INADIMPLENTE" | "CANCELAMENTO_SOLICITADO" | "CANCELADO";
    recurringBilling: boolean;
  };
  access: {
    benefits: boolean;
    conventions: boolean;
    conventionDocuments: boolean;
    support: boolean;
  };
  contribution: {
    monthlyAmount: number;
    annualAmount: number;
    effectiveFrom: string;
  } | null;
  openBills: Array<{
    id: string;
    identifier: string;
    amount: number;
    dueDate: string;
    status: string;
    hasPix: boolean;
    hasPdf: boolean;
  }>;
  news: Array<{
    id: string;
    title: string;
    content: string;
    publishedAt: string | null;
  }>;
  cancellation: {
    status: string;
    requestedAt: string;
  } | null;
}

export interface MemberSupport {
  phone: string;
  hours: string;
}

export interface MemberBill {
  id: string;
  identifier: string;
  amount: number;
  dueDate: string;
  status: string;
  pixPayload: string | null;
  pdfUrl: string | null;
  transactions: Array<{
    amount: number;
    status: string;
    paymentMethod: string | null;
    occurredAt: string;
  }>;
}

export interface MemberBenefit {
  id: string;
  title: string;
  description: string;
}

export interface MemberConvention {
  id: string;
  title: string;
  summary: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  publishedAt: string | null;
  attachments: Array<{ id: string; fileName: string; url: string }>;
  salaryScales: Array<{
    id: string;
    jobTitle: string;
    floorAmount: number;
  }>;
}

export interface MemberNews {
  id: string;
  title: string;
  content: string;
  publishedAt: string | null;
}

export interface AdminOverview {
  metrics: {
    totalAssociates: number;
    upToDateAssociates: number;
    overdueAssociates: number;
    disabledAssociates: number;
    draftBills: number;
    pendingCancellations: number;
  };
  page: number;
  pageSize: number;
  total: number;
  associates: Array<{
    id: string;
    cnpj: string;
    legalName: string;
    tradeName: string | null;
    status: string;
    recurringBilling: boolean;
    manuallyBlocked: boolean;
    lastBill: {
      identifier: string;
      amount: number;
      dueDate: string;
      status: string;
    } | null;
  }>;
}

export interface AdminRegistration {
  id: string;
  email: string;
  registrationStatus: "PENDING_EMAIL" | "PENDING_APPROVAL" | "APPROVED";
  registrationRequestedAt: string | null;
  registrationApprovedAt: string | null;
  welcomeEmailSentAt: string | null;
  associate: {
    id: string;
    legalName: string;
    tradeName: string | null;
    cnpj: string;
  };
}

export interface RegistrationResult {
  message: string;
  status?: "APPROVED";
  welcomeEmailSent?: boolean;
  id?: string;
}

export interface AdminConvention extends MemberConvention {
  createdAt: string;
  updatedAt: string;
}

export interface AdminBenefit extends MemberBenefit {
  isActive: boolean;
  updatedAt: string;
}

export interface AdminContributionProposal {
  id: string;
  monthlyAmount: number;
  annualAmount: number;
  annualDiscountPercent: number;
  effectiveFrom: string;
  status: "PENDING_HOMOLOGATION" | "APPROVED" | "REJECTED";
  note: string | null;
  decisionNote: string | null;
  submittedAt: string;
  submittedBy: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface AdminContributions {
  current: {
    id: string;
    monthlyAmount: number;
    annualAmount: number;
    effectiveFrom: string;
  } | null;
  history: Array<{
    id: string;
    monthlyAmount: number;
    annualAmount: number;
    effectiveFrom: string;
    createdAt: string;
  }>;
  proposals: AdminContributionProposal[];
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

interface ApiErrorPayload {
  message?: string | string[];
}

async function request<T>(
  endpoint: string,
  body?: Record<string, unknown>,
  method = "POST",
): Promise<T | undefined> {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method,
    credentials: "include",
    ...(body ? { headers: { "Content-Type": "application/json" } } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) {
    return undefined;
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as ApiErrorPayload).message
        : undefined;
    throw new AuthApiError(
      Array.isArray(message)
        ? message.join(" ")
        : (message ?? "Não foi possível concluir a solicitação."),
      response.status,
    );
  }

  return payload as T;
}

export function login(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<
  | {
      requiresTwoFactor: true;
      challengeToken: string;
      maskedEmail: string;
      emailSent: boolean;
    }
  | { user: AuthenticatedUser }
  | undefined
> {
  return request("login", { email, password, rememberMe });
}

export function verifyEmailCode(
  challengeToken: string,
  code: string,
  rememberMe = false,
): Promise<
  | { purpose: "REGISTRATION"; message: string }
  | { purpose: "LOGIN"; user: AuthenticatedUser }
  | undefined
> {
  return request("email/verify", { challengeToken, code, rememberMe });
}

export function resendEmailCode(
  challengeToken: string,
): Promise<{ emailSent: boolean; message: string } | undefined> {
  return request("email/resend", { challengeToken });
}

export function register(values: {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  password: string;
}): Promise<RegistrationResult | undefined> {
  return request("register", values);
}

export function getCurrentUser(): Promise<
  { user: AuthenticatedUser } | undefined
> {
  return request("me", undefined, "GET");
}

export function logout(): Promise<void | undefined> {
  return request("logout");
}

async function memberRequest<T>(
  endpoint: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/member/${endpoint}`, {
    method,
    credentials: "include",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as ApiErrorPayload).message
        : undefined;
    throw new AuthApiError(
      Array.isArray(message)
        ? message.join(" ")
        : (message ?? "Não foi possível concluir a solicitação."),
      response.status,
    );
  }
  return payload as T;
}

export const getMemberOverview = () =>
  memberRequest<MemberOverview>("overview");
export const getMemberBills = () => memberRequest<MemberBill[]>("bills");
export const getMemberBenefits = () =>
  memberRequest<MemberBenefit[]>("benefits");
export const getMemberConventions = () =>
  memberRequest<MemberConvention[]>("conventions");
export const getMemberNews = () => memberRequest<MemberNews[]>("news");
export const getMemberSupport = () => memberRequest<MemberSupport>("support");
export const requestMemberCancellation = () =>
  memberRequest<{ status: string; message: string }>("cancellation", "POST", {
    confirmed: true,
  });

async function adminRequest<T>(
  endpoint: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/admin/${endpoint}`, {
    method,
    credentials: "include",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as ApiErrorPayload).message
        : undefined;
    throw new AuthApiError(
      Array.isArray(message)
        ? message.join(" ")
        : (message ?? "Não foi possível concluir a solicitação."),
      response.status,
    );
  }
  return payload as T;
}

export const getAdminOverview = (query = "") =>
  adminRequest<AdminOverview>(`overview${query ? `?${query}` : ""}`);
export const getAdminRegistrations = () =>
  adminRequest<AdminRegistration[]>("registrations");
export const approveAdminRegistration = (id: string) =>
  adminRequest<RegistrationResult>(
    `registrations/${encodeURIComponent(id)}/approve`,
    "POST",
  );
export const resendAdminRegistrationWelcome = (id: string) =>
  adminRequest<RegistrationResult>(
    `registrations/${encodeURIComponent(id)}/welcome-email`,
    "POST",
  );
export const getAdminContributions = () =>
  adminRequest<AdminContributions>("contributions");
export const submitContributionProposal = (
  annualAmount: number,
  note: string,
) =>
  adminRequest<AdminContributionProposal>("contribution-proposals", "POST", {
    annualAmount,
    note,
  });
export const decideContributionProposal = (
  proposalId: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
) =>
  adminRequest<{ id: string; status: string }>(
    `contribution-proposals/${encodeURIComponent(proposalId)}/decision`,
    "PATCH",
    { decision, note },
  );
export const getAdminConventions = () =>
  adminRequest<AdminConvention[]>("conventions");
export const saveAdminConvention = (
  values: Record<string, unknown>,
  id?: string,
) =>
  adminRequest<AdminConvention>(
    id ? `conventions/${encodeURIComponent(id)}` : "conventions",
    id ? "PATCH" : "POST",
    values,
  );
export const getAdminBenefits = () => adminRequest<AdminBenefit[]>("benefits");
export const saveAdminBenefit = (
  values: Record<string, unknown>,
  id?: string,
) =>
  adminRequest<AdminBenefit>(
    id ? `benefits/${encodeURIComponent(id)}` : "benefits",
    id ? "PATCH" : "POST",
    values,
  );

export function requestPasswordReset(
  email: string,
): Promise<{ message: string } | undefined> {
  return request("password/forgot", { email });
}

export function resetPassword(
  token: string,
  password: string,
): Promise<void | undefined> {
  return request("password/reset", { token, password });
}
