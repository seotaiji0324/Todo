"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  displayName: string;
  email: string;
};

type AppMember = {
  username: string;
  displayName: string;
  role: string;
};

type Task = {
  id: string;
  title: string;
  category: string;
  dueTime: string | null;
  completed: boolean;
  createdAt: string;
};

type Filter = "all" | "open" | "done";

const PREVIEW_TASKS: Task[] = [
  {
    id: "preview-1",
    title: "분기 보고서 마무리",
    category: "업무",
    dueTime: "11:00",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "preview-2",
    title: "치과 예약하기",
    category: "개인",
    dueTime: "14:30",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "preview-3",
    title: "아침 운동",
    category: "건강",
    dueTime: "07:00",
    completed: true,
    createdAt: new Date().toISOString(),
  },
];

const categoryClass: Record<string, string> = {
  업무: "coral",
  개인: "mint",
  건강: "blue",
  공부: "violet",
};

function displayTime(value: string | null) {
  if (!value) return "시간 미정";
  const [hourValue, minute] = value.split(":").map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minute)) return value;
  const period = hourValue < 12 ? "오전" : "오후";
  const hour = hourValue % 12 || 12;
  return `${period} ${hour}:${String(minute).padStart(2, "0")}`;
}

function displayDate() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function TodoApp({
  user,
  isLocalPreview,
}: {
  user: User | null;
  isLocalPreview: boolean;
}) {
  const isPreview = user === null;
  const [tasks, setTasks] = useState<Task[]>(isPreview ? PREVIEW_TASKS : []);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("개인");
  const [dueTime, setDueTime] = useState("");
  const [loading, setLoading] = useState(!isPreview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState<AppMember | null>(null);

  useEffect(() => {
    if (isPreview) return;
    let active = true;

    async function loadTasks() {
      try {
        const response = await fetch("/api/tasks", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            await responseError(response, "할 일을 불러오지 못했어요."),
          );
        }
        const payload = (await response.json()) as {
          tasks: Task[];
          member: AppMember;
        };
        if (!active) return;
        setTasks(payload.tasks);
        setMember(payload.member);
        setError("");
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTasks();
    return () => {
      active = false;
    };
  }, [isPreview]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const openCount = tasks.length - completedCount;
  const progress = tasks.length ? (completedCount / tasks.length) * 100 : 0;
  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filter === "open") return !task.completed;
        if (filter === "done") return task.completed;
        return true;
      }),
    [filter, tasks],
  );

  const accountName = member?.displayName ?? user?.displayName;
  const displayName = accountName?.includes("@")
    ? accountName.split("@")[0]
    : accountName?.split(" ")[0] ?? "관리자";
  const initial = displayName.slice(0, 1).toUpperCase();

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;

    const draft: Task = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      category,
      dueTime: dueTime || null,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setSaving(true);
    setError("");
    try {
      if (isPreview) {
        setTasks((current) => [draft, ...current]);
      } else {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            category,
            dueTime: dueTime || null,
          }),
        });
        if (!response.ok) {
          throw new Error(
            await responseError(response, "할 일을 저장하지 못했어요."),
          );
        }
        const payload = (await response.json()) as { task: Task };
        setTasks((current) => [payload.task, ...current]);
      }
      setTitle("");
      setDueTime("");
      setFilter("all");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    const nextCompleted = !task.completed;
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, completed: nextCompleted } : item,
      ),
    );
    if (isPreview) return;

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: task.id, completed: nextCompleted }),
    });
    if (!response.ok) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, completed: task.completed } : item,
        ),
      );
      setError("완료 상태를 바꾸지 못했어요.");
    }
  }

  async function removeTask(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (isPreview) return;

    const response = await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: task.id }),
    });
    if (!response.ok) {
      setTasks((current) => [task, ...current]);
      setError("할 일을 삭제하지 못했어요.");
    }
  }

  return (
    <main className="app-shell">
      <section className="todo-app" aria-label="할 일 관리 앱">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="하루 홈">
            <span>Today&apos;s 하루</span>
          </a>
          <div className="account">
            {isPreview ? (
              <a
                className="preview-badge"
                href={
                  isLocalPreview
                    ? "/api/dev-login"
                    : "/signin-with-chatgpt?return_to=%2F"
                }
              >
                미리보기 · 로그인
              </a>
            ) : (
              <span className="sync-status">
                <i /> {member?.role === "admin" ? "관리자 · " : ""}
                안전하게 동기화됨
              </span>
            )}
            <span className="profile" aria-label={`${displayName} 프로필`}>{initial}</span>
          </div>
        </header>

        <div className="hero" id="top">
          <div className="hero-copy-block">
            <p className="eyebrow">{displayDate()}</p>
            <h1>
              {isPreview ? (
                "좋은 하루 되세요 화이팅!"
              ) : (
                <>
                  좋은 하루예요
                  <span className="hero-name">{displayName}님.</span>
                </>
              )}
            </h1>
            <p className="hero-copy">오늘의 작은 완료가 내일의 여유를 만들어요.</p>
          </div>
          <div className="hero-visual">
            <Image
              src="/haru-library.png"
              alt="햇살이 드는 원목 서재와 책장, 독서 테이블"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 46vw"
            />
            <div
              className="progress-ring"
              style={{ "--progress": `${progress}%` } as React.CSSProperties}
              aria-label={`전체 할 일 ${tasks.length}개 중 ${completedCount}개 완료`}
            >
              <span>{completedCount}/{tasks.length}</span>
              <small>완료</small>
            </div>
          </div>
        </div>

        <form className="quick-add" onSubmit={addTask}>
          <label className="sr-only" htmlFor="new-task">새 할 일</label>
          <input
            id="new-task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="새 할 일을 입력하세요"
            autoComplete="off"
            maxLength={120}
          />
          <label className="sr-only" htmlFor="task-category">분류</label>
          <select
            id="task-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="할 일 분류"
          >
            <option>개인</option>
            <option>업무</option>
            <option>건강</option>
            <option>공부</option>
          </select>
          <label className="sr-only" htmlFor="task-time">시간</label>
          <input
            className="time-input"
            id="task-time"
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            aria-label="할 일 시간"
          />
          <button type="submit" disabled={!title.trim() || saving}>
            {saving ? "저장 중" : "추가"}
          </button>
        </form>

        <div className="list-toolbar">
          <nav className="filters" aria-label="할 일 필터">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">
              전체 <span>{tasks.length}</span>
            </button>
            <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")} type="button">
              진행 중 <span>{openCount}</span>
            </button>
            <button className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")} type="button">
              완료 <span>{completedCount}</span>
            </button>
          </nav>
          {!isPreview && (
            <a
              className="signout"
              href={
                isLocalPreview
                  ? "/api/dev-logout"
                  : "/signout-with-chatgpt?return_to=%2F"
              }
            >
              로그아웃
            </a>
          )}
        </div>

        {error && <p className="error-message" role="status">{error}</p>}

        <section className="task-section">
          <div className="section-heading">
            <h2>{filter === "done" ? "완료한 일" : filter === "open" ? "진행 중" : "오늘"}</h2>
            <span>{openCount ? `${openCount}개 남음` : "모두 완료"}</span>
          </div>

          {loading ? (
            <div className="loading-state" role="status">할 일을 불러오는 중이에요…</div>
          ) : visibleTasks.length ? (
            <div className="task-list">
              {visibleTasks.map((task) => (
                <article className={`task-card ${task.completed ? "done" : ""}`} key={task.id}>
                  <input
                    className="check"
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => void toggleTask(task)}
                    aria-label={`${task.title}을(를) ${task.completed ? "진행 중" : "완료"}으로 표시`}
                  />
                  <div className="task-copy">
                    <h3>{task.title}</h3>
                    <p>
                      <span className={`tag ${categoryClass[task.category] ?? "mint"}`}>{task.category}</span>
                      <span>{displayTime(task.dueTime)}</span>
                    </p>
                  </div>
                  {member?.role === "admin" && (
                    <button
                      className="delete-task"
                      type="button"
                      onClick={() => void removeTask(task)}
                      aria-label={`${task.title} 삭제`}
                    >
                      삭제
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{filter === "done" ? "아직 완료한 일이 없어요" : "가벼운 하루가 기다리고 있어요"}</h3>
              <p>{filter === "done" ? "작은 일부터 하나씩 완료해 보세요." : "위 입력창에 첫 할 일을 적어보세요."}</p>
            </div>
          )}
        </section>
      </section>
      <footer>하나씩, 천천히. 오늘도 충분해요.</footer>
    </main>
  );
}
