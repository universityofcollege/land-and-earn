import { getDashboardData } from "../../../lib/data";

export async function GET() {
  try {
    return Response.json(await getDashboardData());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dashboard unavailable." }, { status: 500 });
  }
}
