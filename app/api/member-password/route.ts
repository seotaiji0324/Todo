import { authorizeBasicMember } from "../../../db/basic-auth";
import { updateMemberPassword } from "../../../db/member-store";
import { createPasswordCredentials } from "../../../db/password-crypto";

const ALLOWED_ORIGINS = new Set([
  "https://seotaiji0324.github.io",
  "http://localhost:3002",
]);

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 });
  }
  return withCors(request, new Response(null, { status: 204 }));
}

export async function PATCH(request: Request) {
  try {
    const member = await authorizeBasicMember(request);
    if (!member) {
      return withCors(
        request,
        Response.json(
          { error: "현재 비밀번호를 확인해 주세요." },
          { status: 401 },
        ),
      );
    }
    if (member.role !== "admin") {
      return withCors(
        request,
        Response.json(
          { error: "관리자만 비밀번호를 변경할 수 있습니다." },
          { status: 403 },
        ),
      );
    }

    const payload = (await request.json()) as { newPassword?: unknown };
    const newPassword =
      typeof payload.newPassword === "string" ? payload.newPassword : "";
    if (newPassword.length < 12 || newPassword.length > 128) {
      return withCors(
        request,
        Response.json(
          { error: "새 비밀번호는 12자 이상 128자 이하로 입력해 주세요." },
          { status: 400 },
        ),
      );
    }

    const { passwordHash, passwordSalt } =
      await createPasswordCredentials(newPassword);
    const updatedMember = await updateMemberPassword(
      member.id,
      passwordHash,
      passwordSalt,
    );

    if (!updatedMember) {
      return withCors(
        request,
        Response.json({ error: "멤버를 찾을 수 없습니다." }, { status: 404 }),
      );
    }

    return withCors(request, Response.json({ changed: true }));
  } catch (error) {
    console.error("Member password change error", error);
    return withCors(
      request,
      Response.json(
        { error: "비밀번호를 변경하는 중 문제가 발생했습니다." },
        { status: 500 },
      ),
    );
  }
}
