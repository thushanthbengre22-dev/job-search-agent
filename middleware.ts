import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://www.bengredev.com",
  "https://bengredev.com",
  "https://jobsearch.bengredev.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": isAllowed ? origin : "",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Block requests from disallowed origins (non-browser requests have no origin header,
  // so direct curl/script abuse is blocked while server-side rewrites from bengredev.com pass through)
  if (origin && !isAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};