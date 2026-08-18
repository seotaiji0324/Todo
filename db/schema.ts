import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    authUserId: text("auth_user_id"),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_members_auth_user_id").on(table.authUserId),
    uniqueIndex("idx_members_username").on(table.username),
    uniqueIndex("idx_members_email").on(table.email),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("개인"),
    dueTime: text("due_time"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_tasks_owner_completed").on(table.ownerId, table.completed),
    index("idx_tasks_owner_created").on(table.ownerId, table.createdAt),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type Member = typeof members.$inferSelect;
