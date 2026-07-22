import { env } from "cloudflare:workers";

export type ApplicationRole = "program_manager" | "fiscal_reviewer";

export type RequestIdentity = {
  email: string;
  name: string;
  actor: string;
  role: ApplicationRole;
  canManage: boolean;
};

export class AccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

function emailSet(value?: string) {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function optionalFullName(request: Request) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  if (!encoded || request.headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return null;
  try {
    return decodeURIComponent(encoded).trim() || null;
  } catch {
    return null;
  }
}

export function requireIdentity(request: Request, permission: "read" | "manage" = "read"): RequestIdentity {
  const url = new URL(request.url);
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (!email && local && env.AUTH_MODE !== "required") {
    return { email: "local@land-and-earn.test", name: "Local program manager", actor: "Local program manager <local@land-and-earn.test>", role: "program_manager", canManage: true };
  }
  if (!email) throw new AccessError("Sign in through the private Land and Earn workspace to continue.", 401);

  const managers = emailSet(env.PROGRAM_MANAGER_EMAILS);
  const reviewers = emailSet(env.FISCAL_REVIEWER_EMAILS);
  const role: ApplicationRole | null = managers.has(email) ? "program_manager" : reviewers.has(email) ? "fiscal_reviewer" : null;
  if (!role) throw new AccessError("Your signed-in account has not been assigned access to Land and Earn.");
  if (permission === "manage" && role !== "program_manager") throw new AccessError("Fiscal reviewers have read-only access. A program manager must perform this action.");

  const name = optionalFullName(request) ?? email;
  return { email, name, actor: `${name} <${email}>`, role, canManage: role === "program_manager" };
}

export function accessErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}
