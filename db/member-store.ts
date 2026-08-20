import { eq, sql } from "drizzle-orm";
import {
  queryExternalCloudflareD1,
  usesExternalCloudflareD1,
} from "./cloudflare-d1-http";
import { getDb } from "./index";
import { members, type Member } from "./schema";

type ExternalMemberRow = {
  id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string;
  email: string;
  password_hash: string | null;
  password_salt: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

const EXTERNAL_MEMBER_COLUMNS = [
  "id",
  "auth_user_id",
  "username",
  "display_name",
  "email",
  "password_hash",
  "password_salt",
  "role",
  "status",
  "last_login_at",
  "created_at",
  "updated_at",
].join(", ");

function mapExternalMember(row: ExternalMemberRow): Member {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findMemberByUsername(
  username: string,
): Promise<Member | null> {
  if (usesExternalCloudflareD1()) {
    const [row] = await queryExternalCloudflareD1<ExternalMemberRow>(
      `SELECT ${EXTERNAL_MEMBER_COLUMNS} FROM members WHERE username = ? LIMIT 1`,
      [username],
    );
    return row ? mapExternalMember(row) : null;
  }

  const [member] = await getDb()
    .select()
    .from(members)
    .where(eq(members.username, username))
    .limit(1);
  return member ?? null;
}

export async function findMemberById(id: string): Promise<Member | null> {
  if (usesExternalCloudflareD1()) {
    const [row] = await queryExternalCloudflareD1<ExternalMemberRow>(
      `SELECT ${EXTERNAL_MEMBER_COLUMNS} FROM members WHERE id = ? LIMIT 1`,
      [id],
    );
    return row ? mapExternalMember(row) : null;
  }

  const [member] = await getDb()
    .select()
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  return member ?? null;
}

export async function recordMemberLogin(id: string): Promise<void> {
  if (usesExternalCloudflareD1()) {
    await queryExternalCloudflareD1(
      "UPDATE members SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );
    return;
  }

  await getDb()
    .update(members)
    .set({
      lastLoginAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(members.id, id));
}

export async function updateMemberPassword(
  id: string,
  passwordHash: string,
  passwordSalt: string,
): Promise<boolean> {
  if (usesExternalCloudflareD1()) {
    const rows = await queryExternalCloudflareD1<{ id: string }>(
      "UPDATE members SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id",
      [passwordHash, passwordSalt, id],
    );
    return rows.length > 0;
  }

  const [updatedMember] = await getDb()
    .update(members)
    .set({
      passwordHash,
      passwordSalt,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(members.id, id))
    .returning({ id: members.id });
  return Boolean(updatedMember);
}
