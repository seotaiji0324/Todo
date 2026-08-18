import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", { status: 404 });
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("haru-dev-admin", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
  return response;
}
