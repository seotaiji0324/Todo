import assert from "node:assert/strict";
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

test("renders the complete 2026 dashboard task experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>Today's 하루 — 2026 관리 템플릿<\/title>/);
  assert.match(html, /새 일정을 입력하세요/);
  assert.match(html, /OPIc 1일차 완성/);
  assert.match(html, /대학생을 위한 2026 관리 템플릿/);
  assert.match(html, /미리보기 · 로그인/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
