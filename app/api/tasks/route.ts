import { and, desc, eq, sql } from "drizzle-orm";
import { authorizeBasicMember } from "../../../db/basic-auth";
import { authorizeMember } from "../../../db/members";
import type { Member } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { tasks } from "../../../db/schema";

const CATEGORIES = new Set(["개인", "업무", "건강", "공부"]);
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ALLOWED_ORIGINS = new Set([
  "https://seotaiji0324.github.io",
  "http://localhost:3002",
]);

type Identity = {
  member: Member;
  legacyOwnerId: string | null;
};

function unauthorized() {
  return Response.json(
    { error: "아이디 또는 비밀번호를 확인해 주세요." },
    { status: 401 },
  );
}

function forbidden() {
  return Response.json(
    { error: "등록된 멤버만 이용할 수 있습니다." },
    { status: 403 },
  );
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

async function authorizeRequest(
  request: Request,
): Promise<Identity | { response: Response }> {
  const basicMember = await authorizeBasicMember(request);
  if (basicMember) {
    return { member: basicMember, legacyOwnerId: null };
  }

  const user = await getChatGPTUser();
  if (!user) return { response: unauthorized() };

  const member = await authorizeMember(user);
  if (!member) return { response: forbidden() };

  return { member, legacyOwnerId: user.userId };
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

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleGet(request: Request): Promise<Response> {
  try {
    const identity = await authorizeRequest(request);
    if ("response" in identity) return identity.response;

    const db = getDb();
    if (identity.legacyOwnerId) {
      await db
        .update(tasks)
        .set({ ownerId: identity.member.id })
        .where(eq(tasks.ownerId, identity.legacyOwnerId));
    }

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

async function handlePost(request: Request): Promise<Response> {
  try {
    const identity = await authorizeRequest(request);
    if ("response" in identity) return identity.response;

    const payload = (await request.json()) as {
      title?: unknown;
      category?: unknown;
      dueDate?: unknown;
      dueTime?: unknown;
    };
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const category =
      typeof payload.category === "string" && CATEGORIES.has(payload.category)
        ? payload.category
        : "개인";
    const dueDate = isValidDate(payload.dueDate) ? payload.dueDate : null;
    const dueTime =
      typeof payload.dueTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.dueTime)
        ? payload.dueTime
        : null;

    if (!title || title.length > 120) {
      return Response.json(
        { error: "할 일은 1자 이상 120자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!dueDate) {
      return Response.json(
        { error: "일정의 연월일을 선택해 주세요." },
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
        dueDate,
        dueTime,
      })
      .returning();

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

async function handlePatch(request: Request): Promise<Response> {
  try {
    const identity = await authorizeRequest(request);
    if ("response" in identity) return identity.response;

    const payload = (await request.json()) as {
      id?: unknown;
      completed?: unknown;
      title?: unknown;
      category?: unknown;
      dueDate?: unknown;
      dueTime?: unknown;
    };
    if (typeof payload.id !== "string") {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const updates: {
      completed?: boolean;
      title?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string | null;
    } = {};
    const editsSchedule =
      "title" in payload ||
      "category" in payload ||
      "dueDate" in payload ||
      "dueTime" in payload;

    if (editsSchedule && identity.member.role !== "admin") {
      return Response.json(
        { error: "관리자만 일정을 수정할 수 있습니다." },
        { status: 403 },
      );
    }

    if ("completed" in payload) {
      if (typeof payload.completed !== "boolean") {
        return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
      }
      updates.completed = payload.completed;
    }

    if ("title" in payload) {
      const title =
        typeof payload.title === "string" ? payload.title.trim() : "";
      if (!title || title.length > 120) {
        return Response.json(
          { error: "할 일은 1자 이상 120자 이하로 입력해 주세요." },
          { status: 400 },
        );
      }
      updates.title = title;
    }

    if ("category" in payload) {
      if (
        typeof payload.category !== "string" ||
        !CATEGORIES.has(payload.category)
      ) {
        return Response.json(
          { error: "잘못된 분류입니다." },
          { status: 400 },
        );
      }
      updates.category = payload.category;
    }

    if ("dueDate" in payload) {
      if (!isValidDate(payload.dueDate)) {
        return Response.json(
          { error: "올바른 연월일을 선택해 주세요." },
          { status: 400 },
        );
      }
      updates.dueDate = payload.dueDate;
    }

    if ("dueTime" in payload) {
      if (
        payload.dueTime !== null &&
        (typeof payload.dueTime !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.dueTime))
      ) {
        return Response.json(
          { error: "잘못된 시간입니다." },
          { status: 400 },
        );
      }
      updates.dueTime = payload.dueTime;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "수정할 내용이 없습니다." },
        { status: 400 },
      );
    }

    const [task] = await getDb()
      .update(tasks)
      .set({
        ...updates,
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

async function handleDelete(request: Request): Promise<Response> {
  try {
    const identity = await authorizeRequest(request);
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

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 });
  }
  return withCors(request, new Response(null, { status: 204 }));
}

export async function GET(request: Request) {
  return withCors(request, await handleGet(request));
}

export async function POST(request: Request) {
  return withCors(request, await handlePost(request));
}

export async function PATCH(request: Request) {
  return withCors(request, await handlePatch(request));
}

export async function DELETE(request: Request) {
  return withCors(request, await handleDelete(request));
}
