"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AppMember = { username: string; displayName: string; role: string };
type Task = {
  id: string;
  title: string;
  category: string;
  dueDate: string | null;
  dueTime: string | null;
  completed: boolean;
  createdAt: string;
};
type Filter = "all" | "open" | "done";
type CategoryFilter = "all" | "개인" | "업무" | "건강" | "공부";

const PREVIEW_TASKS: Task[] = [
  { id: "preview-1", title: "OPIc 1일차 완성", category: "공부", dueDate: dateValue(), dueTime: "11:00", completed: true, createdAt: new Date().toISOString() },
  { id: "preview-2", title: "분석 신청", category: "업무", dueDate: dateValue(), dueTime: "14:30", completed: false, createdAt: new Date().toISOString() },
  { id: "preview-3", title: "관리 템플릿 문장 수정", category: "개인", dueDate: dateValue(1), dueTime: "16:00", completed: false, createdAt: new Date().toISOString() },
  { id: "preview-4", title: "저녁 산책하기", category: "건강", dueDate: dateValue(2), dueTime: "20:00", completed: false, createdAt: new Date().toISOString() },
  { id: "preview-5", title: "기숙사 신청", category: "개인", dueDate: dateValue(4), dueTime: "09:00", completed: false, createdAt: new Date().toISOString() },
  { id: "preview-6", title: "연구실 미팅", category: "업무", dueDate: dateValue(6), dueTime: "13:00", completed: false, createdAt: new Date().toISOString() },
  { id: "preview-7", title: "여행 준비 체크", category: "개인", dueDate: dateValue(8), dueTime: "18:30", completed: true, createdAt: new Date().toISOString() },
  { id: "preview-8", title: "독서 30분", category: "공부", dueDate: dateValue(10), dueTime: "21:00", completed: false, createdAt: new Date().toISOString() },
];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string; icon: string }> = [
  { value: "all", label: "전체 일정", icon: "dashboard" },
  { value: "개인", label: "개인", icon: "person" },
  { value: "업무", label: "업무", icon: "work" },
  { value: "건강", label: "건강", icon: "favorite" },
  { value: "공부", label: "공부", icon: "school" },
];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const categoryClass: Record<string, string> = { 업무: "coral", 개인: "mint", 건강: "blue", 공부: "violet" };

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-rounded" aria-hidden="true">{name}</span>;
}

function displayTime(value: string | null) {
  if (!value) return "시간 미정";
  const [hourValue, minute] = value.split(":").map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minute)) return value;
  const period = hourValue < 12 ? "오전" : "오후";
  const hour = hourValue % 12 || 12;
  return `${period} ${hour}:${String(minute).padStart(2, "0")}`;
}

function dateValue(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayTaskSchedule(task: Task) {
  const date = task.dueDate
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(`${task.dueDate}T00:00:00+09:00`))
    : "날짜 미정";
  return `${date} · ${displayTime(task.dueTime)}`;
}

function displayDate() {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" }).format(new Date());
}

function displayYear() {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function displayCurrentPeriod() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", timeZone: "Asia/Seoul" }).format(date);
}

function taskCalendarDay(task: Task, month: Date) {
  const match = task.dueDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, monthValue, day] = match;
  if (
    Number(year) !== month.getFullYear() ||
    Number(monthValue) !== month.getMonth() + 1
  ) {
    return null;
  }
  return Number(day);
}

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function PlanGroup({ label, tasks, member, onToggle, onRemove }: {
  label: string;
  tasks: Task[];
  member: AppMember | null;
  onToggle: (task: Task) => void;
  onRemove: (task: Task) => void;
}) {
  if (!tasks.length) return null;
  return (
    <section className="plan-group">
      <h3><Icon name="arrow_drop_down" /> {label}</h3>
      <div className="plan-items">
        {tasks.map((task) => (
          <article className={`plan-task ${task.completed ? "done" : ""}`} key={task.id}>
            <input className="check" type="checkbox" checked={task.completed} onChange={() => onToggle(task)} aria-label={`${task.title}을(를) ${task.completed ? "진행 중" : "완료"}으로 표시`} />
            <div className="plan-task-copy">
              <strong>{task.title}</strong>
              <small>{displayTaskSchedule(task)}</small>
            </div>
            <span className={`status-tag ${categoryClass[task.category] ?? "mint"}`}>{task.category}</span>
            {member?.role === "admin" && (
              <button className="icon-button delete-task" type="button" onClick={() => onRemove(task)} aria-label={`${task.title} 삭제`} title="일정 삭제">
                <Icon name="delete" />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function TodoApp({ initialMember }: { initialMember: AppMember | null }) {
  const [member, setMember] = useState<AppMember | null>(initialMember);
  const isPreview = member === null;
  const [tasks, setTasks] = useState<Task[]>(isPreview ? PREVIEW_TASKS : []);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("개인");
  const [dueDate, setDueDate] = useState(dateValue);
  const [dueTime, setDueTime] = useState("");
  const [loading, setLoading] = useState(!isPreview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loginOpen, setLoginOpen] = useState(initialMember === null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    async function loadTasks() {
      try {
        setLoading(true);
        const response = await fetch("/api/tasks", { cache: "no-store" });
        if (response.status === 401) {
          if (active) {
            setMember(null);
            setTasks(PREVIEW_TASKS);
            setLoginOpen(true);
            setError("로그인 시간이 만료되었습니다. 다시 로그인해 주세요.");
          }
          return;
        }
        if (!response.ok) throw new Error(await responseError(response, "할 일을 불러오지 못했어요."));
        const payload = (await response.json()) as { tasks: Task[]; member: AppMember };
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
    return () => { active = false; };
  }, [isPreview]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const openCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const categoryTasks = useMemo(() => tasks.filter((task) => categoryFilter === "all" || task.category === categoryFilter), [categoryFilter, tasks]);
  const visibleTasks = useMemo(() => categoryTasks.filter((task) => filter === "open" ? !task.completed : filter === "done" ? task.completed : true), [categoryTasks, filter]);
  const accountName = member?.displayName;
  const displayName = accountName?.includes("@") ? accountName.split("@")[0] : accountName?.split(" ")[0] ?? "관리자";
  const initial = displayName.slice(0, 1).toUpperCase();
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const firstWeekday = calendarDate.getDay();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const tasksByDay = categoryTasks.reduce<Record<number, Task[]>>((result, task) => {
    const day = taskCalendarDay(task, calendarDate);
    if (day) result[day] = [...(result[day] ?? []), task];
    return result;
  }, {});
  const openTasks = visibleTasks.filter((task) => !task.completed);
  const todayTasks = openTasks.filter((task) => task.dueDate === dateValue());
  const upcomingTasks = openTasks.filter((task) => task.dueDate !== dateValue());
  const completedTasks = visibleTasks.filter((task) => task.completed);

  function handleExpiredSession(response: Response) {
    if (response.status !== 401) return false;
    setMember(null);
    setTasks(PREVIEW_TASKS);
    setLoginOpen(true);
    setError("로그인 시간이 만료되었습니다. 다시 로그인해 주세요.");
    return true;
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    setLoginMessage("로그인 중입니다…");

    try {
      const response = await fetch("/api/member-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, "아이디 또는 비밀번호를 확인해 주세요."),
        );
      }
      const payload = (await response.json()) as { member: AppMember };
      setMember(payload.member);
      setTasks([]);
      setLoginPassword("");
      setLoginMessage("");
      setError("");
      setLoginOpen(false);
    } catch (cause) {
      setLoginMessage(
        cause instanceof Error
          ? cause.message
          : "로그인 처리 중 문제가 발생했습니다.",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/member-session", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("로그아웃 처리 중 문제가 발생했습니다.");
      }
      setMember(null);
      setTasks(PREVIEW_TASKS);
      setError("");
      setLoginMessage("로그아웃되었습니다.");
      setLoginOpen(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "로그아웃 처리 중 문제가 발생했습니다.",
      );
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || !dueDate || saving) return;
    const draft: Task = { id: crypto.randomUUID(), title: cleanTitle, category, dueDate, dueTime: dueTime || null, completed: false, createdAt: new Date().toISOString() };
    setSaving(true);
    setError("");
    try {
      if (isPreview) {
        setTasks((current) => [draft, ...current]);
      } else {
        const response = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: cleanTitle, category, dueDate, dueTime: dueTime || null }) });
        if (handleExpiredSession(response)) return;
        if (!response.ok) throw new Error(await responseError(response, "할 일을 저장하지 못했어요."));
        const payload = (await response.json()) as { task: Task };
        setTasks((current) => [payload.task, ...current]);
      }
      setTitle("");
      setCalendarDate(new Date(`${dueDate}T00:00:00`));
      setDueDate(dateValue());
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
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: nextCompleted } : item));
    if (isPreview) return;
    const response = await fetch("/api/tasks", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, completed: nextCompleted }) });
    if (handleExpiredSession(response)) return;
    if (!response.ok) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: task.completed } : item));
      setError("완료 상태를 바꾸지 못했어요.");
    }
  }

  async function removeTask(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (isPreview) return;
    const response = await fetch("/api/tasks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id }) });
    if (handleExpiredSession(response)) return;
    if (!response.ok) {
      setTasks((current) => [task, ...current]);
      setError("할 일을 삭제하지 못했어요.");
    }
  }

  function moveMonth(offset: number) {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <main className="app-shell">
      <section className="todo-app" aria-label="할 일 관리 앱">
        <header className="page-header" id="top">
          <div className="title-block">
            <Image className="calendar-mark" src="/dashboard-calendar-mark.png" alt="분홍색 탁상 달력 일러스트" width={72} height={72} priority />
            <div>
              <p className="header-kicker">TODAY&apos;S HARU · {displayDate()}</p>
              <h1>{displayCurrentPeriod()} 일정 관리</h1>
            </div>
          </div>
          <div className="account">
            {isPreview ? (
              <button className="preview-badge" type="button" onClick={() => setLoginOpen(true)}>
                <Icon name="login" /> Cloudflare 멤버 로그인
              </button>
            ) : (
              <span className="sync-status"><Icon name="cloud_done" />{member?.role === "admin" ? "관리자 · " : ""}동기화됨</span>
            )}
            <span className="profile" aria-label={`${displayName} 프로필`}>{initial}</span>
          </div>
        </header>

        {error && <p className="error-message" role="status">{error}</p>}

        <div className="dashboard-grid">
          <aside className="tool-rail" aria-label="일정 분류">
            <div className="rail-title"><span>Buttons</span><i /></div>
            <nav className="category-nav">
              {CATEGORY_OPTIONS.map((item) => (
                <button className={`${categoryClass[item.value] ?? "neutral"} ${categoryFilter === item.value ? "active" : ""}`} key={item.value} type="button" onClick={() => setCategoryFilter(item.value)}>
                  <Icon name={item.icon} />{item.label}
                </button>
              ))}
            </nav>
            <section className="efficiency-card" aria-label={`오늘의 완료율 ${progress}%`}>
              <div className="efficiency-heading"><span><Icon name="speed" /> Efficiency</span><Icon name="tune" /></div>
              <div className="efficiency-visual"><Icon name="donut_large" /><strong>{progress}%</strong></div>
              <p>{completedCount}개 완료 · {openCount}개 남음</p>
            </section>
          </aside>

          <section className="calendar-panel" aria-label="월간 일정">
            <div className="panel-heading">
              <div>
                <p className="panel-eyebrow">{displayYear()} 전체 일정</p>
                <div className="view-tabs" aria-label="일정 보기 방식">
                  <button className="active" type="button"><Icon name="calendar_month" /> Calendar</button>
                  <button type="button"><Icon name="table_rows" /> sch</button>
                </div>
              </div>
              <button className="icon-button" type="button" aria-label="일정 보기 설정"><Icon name="tune" /></button>
            </div>
            <div className="month-toolbar">
              <strong>{monthLabel(calendarDate)}</strong>
              <div>
                <button className="today-button" type="button" onClick={() => setCalendarDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}><Icon name="today" /> 오늘</button>
                <button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><Icon name="chevron_left" /></button>
                <button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><Icon name="chevron_right" /></button>
              </div>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
            <div className="calendar-grid">
              {calendarCells.map((day, index) => (
                <div className={`calendar-cell ${day === new Date().getDate() && calendarDate.getMonth() === new Date().getMonth() ? "today" : ""}`} key={index}>
                  {day && <><span className="day-number">{day}</span><div className="calendar-events">
                    {(tasksByDay[day] ?? []).map((task) => (
                      <button className={`calendar-event ${categoryClass[task.category] ?? "mint"} ${task.completed ? "done" : ""}`} key={task.id} type="button" onClick={() => void toggleTask(task)} title={`${task.title} · ${displayTime(task.dueTime)}`}>{task.title}</button>
                    ))}
                  </div></>}
                </div>
              ))}
            </div>
          </section>

          <aside className="daily-panel" aria-label="일일 계획">
            <div className="daily-heading">
              <div><p>Daily Plan</p><strong>{isPreview ? "좋은 하루 되세요 화이팅!" : `좋은 하루예요 ${displayName}님.`}</strong></div>
              {!isPreview && <button className="signout" type="button" onClick={() => void signOut()}>로그아웃</button>}
            </div>
            <nav className="filters" aria-label="할 일 필터">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button"><Icon name="adjust" /> 전체 {tasks.length}</button>
              <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")} type="button">진행 중 {openCount}</button>
              <button className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")} type="button">완료 {completedCount}</button>
              <button className="icon-button" type="button" aria-label="목록 보기 설정"><Icon name="tune" /></button>
            </nav>
            <form className="quick-add" onSubmit={addTask}>
              <label className="sr-only" htmlFor="new-task">새 할 일</label>
              <div className="composer-main"><Icon name="add_task" /><input id="new-task" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="새 일정을 입력하세요" autoComplete="off" maxLength={120} /></div>
              <div className="composer-options">
                <label className="sr-only" htmlFor="task-category">분류</label>
                <select id="task-category" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="할 일 분류"><option>개인</option><option>업무</option><option>건강</option><option>공부</option></select>
                <label className="sr-only" htmlFor="task-date">연월일</label>
                <input className="date-input" id="task-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="할 일 연월일" required />
                <label className="sr-only" htmlFor="task-time">시간</label>
                <input className="time-input" id="task-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} aria-label="할 일 시간" />
                <button className="add-button" type="submit" disabled={!title.trim() || !dueDate || saving}><Icon name={saving ? "hourglass_top" : "arrow_upward"} /><span className="sr-only">{saving ? "저장 중" : "추가"}</span></button>
              </div>
            </form>
            {loading ? (
              <div className="loading-state" role="status">할 일을 불러오는 중이에요…</div>
            ) : visibleTasks.length ? (
              <div className="plan-list">
                <PlanGroup label="오늘" tasks={todayTasks} member={member} onToggle={(task) => void toggleTask(task)} onRemove={(task) => void removeTask(task)} />
                <PlanGroup label="예정" tasks={upcomingTasks} member={member} onToggle={(task) => void toggleTask(task)} onRemove={(task) => void removeTask(task)} />
                <PlanGroup label="완료" tasks={completedTasks} member={member} onToggle={(task) => void toggleTask(task)} onRemove={(task) => void removeTask(task)} />
              </div>
            ) : (
              <div className="empty-state"><Icon name="event_available" /><h3>표시할 일정이 없어요</h3><p>필터를 바꾸거나 새 일정을 추가해 보세요.</p></div>
            )}
          </aside>
        </div>

        {loginOpen && (
          <div className="login-overlay">
            <section className="member-login" role="dialog" aria-modal="true" aria-labelledby="member-login-title">
              <div className="member-login-heading">
                <div>
                  <p>Cloudflare D1</p>
                  <h2 id="member-login-title">멤버 로그인</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setLoginOpen(false)} aria-label="로그인 창 닫기"><Icon name="close" /></button>
              </div>
              <p className="member-login-description">members 테이블에 등록된 계정으로 로그인해 주세요.</p>
              <form className="member-login-form" onSubmit={signIn}>
                <label htmlFor="login-username">아이디</label>
                <input id="login-username" name="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} autoComplete="username" maxLength={64} required />
                <label htmlFor="login-password">비밀번호</label>
                <input id="login-password" name="password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" maxLength={128} required />
                <button className="member-login-submit" type="submit" disabled={loggingIn}>{loggingIn ? "로그인 중…" : "로그인"}</button>
                <p className="login-message" role="status">{loginMessage}</p>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
