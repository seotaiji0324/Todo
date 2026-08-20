import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the complete current-month dashboard task experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>\d{4}년 \d{1,2}월 일정 관리<\/title>/);
  assert.match(html, /새 일정을 입력하세요/);
  assert.match(html, /id="task-date"[^>]*type="date"/);
  assert.match(html, /할 일 연월일/);
  assert.match(html, /OPIc 1일차 완성/);
  assert.match(html, /\d{4}년 \d{1,2}월 일정 관리/);
  assert.match(html, /로그인 확인 중/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("member login uses an HttpOnly server session instead of browser password storage", async () => {
  const sessionRoute = await readFile(
    new URL("../app/api/member-session/route.ts", import.meta.url),
    "utf8",
  );
  const sessionStore = await readFile(
    new URL("../db/member-session.ts", import.meta.url),
    "utf8",
  );
  const appSource = await readFile(
    new URL("../app/todo-app.tsx", import.meta.url),
    "utf8",
  );

  assert.match(sessionRoute, /findMemberByUsername/);
  assert.match(sessionStore, /HttpOnly/);
  assert.match(sessionStore, /SameSite=Lax/);
  assert.doesNotMatch(appSource, /sessionStorage|localStorage/);
});

test("static Pages calendar renders every task registered for a date", async () => {
  const source = await readFile(new URL("../pages/index.html", import.meta.url), "utf8");
  assert.match(source, /\(tasksByDay\[day\] \|\| \[\]\)\.forEach/);
  assert.doesNotMatch(source, /tasksByDay\[day\][^\n]*\.slice\(/);
});
