import { TodoApp } from "./todo-app";

export const dynamic = "force-dynamic";

export default function Home() {
  return <TodoApp initialMember={null} />;
}
