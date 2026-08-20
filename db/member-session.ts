import { findMemberById } from "./member-store";
import type { Member } from "./schema";

const SESSION_COOKIE = "haru_member_session";
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

type SessionPayload = {
  version: 1;
  memberId: string;
  expiresAt: number;
};

export async function createMemberSessionCookie(
  member: Member,
): Promise<string> {
  if (!member.passwordHash || !member.passwordSalt) {
    throw new Error("Member password credentials are unavailable.");
  }

  const payload: SessionPayload = {
    version: 1,
    memberId: member.id,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await signPayload(encodedPayload, member);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secure}`;
}

export function clearMemberSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function authorizeSessionMember(
  request: Request,
): Promise<Member | null> {
  const value = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const encodedPayload = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    ) as SessionPayload;
  } catch {
    return null;
  }

  if (
    payload.version !== 1 ||
    typeof payload.memberId !== "string" ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const member = await findMemberById(payload.memberId);
  if (
    !member ||
    member.status !== "active" ||
    !member.passwordHash ||
    !member.passwordSalt
  ) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload, member);
  return constantTimeEqual(signature, expectedSignature) ? member : null;
}

async function signPayload(payload: string, member: Member): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${member.passwordHash}.${member.passwordSalt}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }
  return null;
}

function constantTimeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
