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

test("renders the complete 하루 task experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>하루 — 차분한 할 일 관리<\/title>/);
  assert.match(html, /새 할 일을 입력하세요/);
  assert.match(html, /분기 보고서 마무리/);
  assert.match(html, /미리보기 · 로그인/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("GitHub Pages 관리자 화면은 일정 수정과 비밀번호 변경 기능을 포함한다", async () => {
  const html = await readFile(
    new URL("../pages/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /id="admin-panel"/);
  assert.match(html, /id="edit-task-form"/);
  assert.match(html, /id="password-form"/);
  assert.match(html, /async function saveTaskEdit/);
  assert.match(html, /async function changePassword/);
  assert.match(html, /async function deleteTask/);

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, "GitHub Pages 스크립트를 찾을 수 없습니다.");
  assert.doesNotThrow(() => new Function(scripts.at(-1)[1]));
});
