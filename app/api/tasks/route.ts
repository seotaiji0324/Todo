import { and, desc, eq, sql } from "drizzle-orm";
import { authorizeMember } from "../../../db/members";
import type { Member } from "../../../db/schema";
import {
  getChatGPTUser,
  type ChatGPTUser,
} from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { tasks } from "../../../db/schema";

const CATEGORIES = new Set(["개인", "업무", "건강", "공부"]);

function unauthorized() {
  return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function forbidden() {
  return Response.json(
    { error: "등록된 멤버만 이용할 수 있습니다." },
    { status: 403 },
  );
}

async function authorizeRequest(): Promise<
  | { user: ChatGPTUser; member: Member }
  | { response: Response }
> {
  const user = await getChatGPTUser();
  if (!user) return { response: unauthorized() };

  const member = await authorizeMember(user);
  if (!member) return { response: forbidden() };

  return { user, member };
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${cause}`;

  if (
    combined.includes("no such table") ||
    combined.includes('from "tasks"') ||
    combined.includes('from "members"')
  ) {
    return Response.json(
      { error: "데이터베이스 준비가 아직 끝나지 않았습니다." },
      { status: 503 },
    );
  }

  console.error("Task database error", error);
  return Response.json(
    { error: "할 일을 처리하는 중 문제가 발생했습니다." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const identity = await authorizeRequest();
    if ("response" in identity) return identity.response;

    const db = getDb();
    await db
      .update(tasks)
      .set({ ownerId: identity.member.id })
      .where(eq(tasks.ownerId, identity.user.userId));

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.ownerId, identity.member.id))
      .orderBy(tasks.completed, desc(tasks.createdAt));

    return Response.json({
      tasks: rows,
      member: {
        username: identity.member.username,
        displayName: identity.member.displayName,
        role: identity.member.role,
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await authorizeRequest();
    if ("response" in identity) return identity.response;

    const payload = (await request.json()) as {
      title?: unknown;
      category?: unknown;
      dueTime?: unknown;
    };
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const category =
      typeof payload.category === "string" && CATEGORIES.has(payload.category)
        ? payload.category
        : "개인";
    const dueTime =
      typeof payload.dueTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.dueTime)
        ? payload.dueTime
        : null;

    if (!title || title.length > 120) {
      return Response.json(
        { error: "할 일은 1자 이상 120자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }

    const [task] = await getDb()
      .insert(tasks)
      .values({
        id: crypto.randomUUID(),
        ownerId: identity.member.id,
        title,
        category,
        dueTime,
      })
      .returning();

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await authorizeRequest();
    if ("response" in identity) return identity.response;

    const payload = (await request.json()) as {
      id?: unknown;
      completed?: unknown;
    };
    if (typeof payload.id !== "string" || typeof payload.completed !== "boolean") {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const [task] = await getDb()
      .update(tasks)
      .set({
        completed: payload.completed,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(tasks.id, payload.id),
          eq(tasks.ownerId, identity.member.id),
        ),
      )
      .returning();

    if (!task) {
      return Response.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
    }

    return Response.json({ task });
  } catch (error) {
    return databaseError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await authorizeRequest();
    if ("response" in identity) return identity.response;
    if (identity.member.role !== "admin") {
      return Response.json(
        { error: "관리자만 할 일을 삭제할 수 있습니다." },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { id?: unknown };
    if (typeof payload.id !== "string") {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const [task] = await getDb()
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, payload.id),
          eq(tasks.ownerId, identity.member.id),
        ),
      )
      .returning();

    if (!task) {
      return Response.json({ error: "할 일을 찾을 수 없습니다." }, { status: 404 });
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return databaseError(error);
  }
}
