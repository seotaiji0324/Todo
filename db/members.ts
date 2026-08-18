import { eq, or, sql } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "./index";
import { members, type Member } from "./schema";

export async function authorizeMember(
  user: ChatGPTUser,
): Promise<Member | null> {
  const email = user.email.trim().toLowerCase();
  const db = getDb();
  const rows = await db
    .select()
    .from(members)
    .where(
      or(
        eq(members.authUserId, user.userId),
        eq(members.email, email),
      ),
    )
    .limit(2);

  const boundMember = rows.find(
    (member) => member.authUserId === user.userId,
  );
  if (boundMember) {
    return boundMember.status === "active" ? boundMember : null;
  }

  const invitedMember = rows.find(
    (member) => member.email.toLowerCase() === email,
  );
  if (
    !invitedMember ||
    invitedMember.status !== "active" ||
    invitedMember.authUserId
  ) {
    return null;
  }

  const [member] = await db
    .update(members)
    .set({
      authUserId: user.userId,
      lastLoginAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(members.id, invitedMember.id))
    .returning();

  return member ?? null;
}
