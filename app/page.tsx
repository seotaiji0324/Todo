import { headers } from "next/headers";
import { TodoApp } from "./todo-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie");
  let member = null;

  if (cookie) {
    try {
      const { authorizeSessionMember } = await import("../db/member-session");
      member = await authorizeSessionMember(
        new Request("https://app.local/", { headers: { cookie } }),
      );
    } catch (error) {
      console.error("Initial member session lookup error", error);
    }
  }

  return (
    <TodoApp
      initialMember={
        member
          ? {
              username: member.username,
              displayName: member.displayName,
              role: member.role,
            }
          : null
      }
    />
  );
}
