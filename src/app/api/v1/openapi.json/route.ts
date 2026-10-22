import { OPENAPI } from "@/server/api/openapi";

export function GET() {
  return Response.json(OPENAPI, { headers: { "cache-control": "public, max-age=300" } });
}
