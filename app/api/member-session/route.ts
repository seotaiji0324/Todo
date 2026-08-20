import { findMemberByUsername, recordMemberLogin } from "../../../db/member-store";
import {
  authorizeSessionMember,
  clearMemberSessionCookie,
  createMemberSessionCookie,
} from "../../../db/member-session";
import { verifyPassword } from "../../../db/password-crypto";

function publicMember(member: {
  username: string;
  displayName: string;
  role: string;
}) {
  return {
    username: member.username,
    displayName: member.displayName,
    role: member.role,
  };
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(request: Request) {
  try {
    const member = await authorizeSessionMember(request);
    if (!member) {
      return noStore(
        Response.json({ error: "로그인이 필요합니다." }, { status: 401 }),
      );
    }
    return noStore(Response.json({ member: publicMember(member) }));
  } catch (error) {
    console.error("Member session lookup error", error);
    return noStore(
      Response.json(
        { error: "로그인 상태를 확인하는 중 문제가 발생했습니다." },
        { status: 500 },
      ),
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username =
      typeof payload.username === "string" ? payload.username.trim() : "";
    const password =
      typeof payload.password === "string" ? payload.password : "";

    if (!username || username.length > 64 || !password || password.length > 128) {
      return noStore(
        Response.json(
          { error: "아이디 또는 비밀번호를 확인해 주세요." },
          { status: 401 },
        ),
      );
    }

    const member = await findMemberByUsername(username);
    if (
      !member ||
      member.status !== "active" ||
      !member.passwordHash ||
      !member.passwordSalt ||
      !(await verifyPassword(password, member.passwordSalt, member.passwordHash))
    ) {
      return noStore(
        Response.json(
          { error: "아이디 또는 비밀번호를 확인해 주세요." },
          { status: 401 },
        ),
      );
    }

    await recordMemberLogin(member.id);
    const response = Response.json({ member: publicMember(member) });
    response.headers.set("Set-Cookie", await createMemberSessionCookie(member));
    return noStore(response);
  } catch (error) {
    console.error("Member login error", error);
    return noStore(
      Response.json(
        { error: "로그인 처리 중 문제가 발생했습니다." },
        { status: 500 },
      ),
    );
  }
}

export function DELETE() {
  const response = new Response(null, { status: 204 });
  response.headers.set("Set-Cookie", clearMemberSessionCookie());
  return noStore(response);
}
