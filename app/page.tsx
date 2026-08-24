import { getChatGPTUser } from "./chatgpt-auth";
import { TodoApp } from "./todo-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <TodoApp
      isLocalPreview={process.env.NODE_ENV === "development"}
      user={
        user
          ? {
              displayName: user.displayName,
              email: user.email,
            }
          : null
      }
    />
  );
}
