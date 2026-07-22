import { getDashboardData } from "../../../lib/data";
import { accessErrorResponse, requireIdentity } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const identity = requireIdentity(request);
    return Response.json({ ...(await getDashboardData()), session: { email: identity.email, name: identity.name, role: identity.role, canManage: identity.canManage } });
  } catch (error) {
    return accessErrorResponse(error, "Dashboard unavailable.");
  }
}
