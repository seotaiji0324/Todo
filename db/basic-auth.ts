import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { members, type Member } from "./schema";

export async function authorizeBasicMember(
  request: Request,
): Promise<Member | null> {
  const credentials = readBasicCredentials(
    request.headers.get("authorization"),
  );
  if (!credentials) return null;

  const [member] = await getDb()
    .select()
    .from(members)
    .where(eq(members.username, credentials.username))
    .limit(1);

  if (
    !member ||
    member.status !== "active" ||
    !member.passwordHash ||
    !member.passwordSalt
  ) {
    return null;
  }

  const actualHash = await derivePasswordHash(
    credentials.password,
    member.passwordSalt,
  );
  return constantTimeEqual(actualHash, member.passwordHash) ? member : null;
}

function readBasicCredentials(
  authorization: string | null,
): { username: string; password: string } | null {
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const encoded = authorization.slice("Basic ".length).trim();
    const decoded = new TextDecoder().decode(base64ToBytes(encoded));
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;

    return {
      username: decoded.slice(0, separator).trim(),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

async function derivePasswordHash(
  password: string,
  salt: string,
): Promise<string> {
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = base64ToBytes(salt);
  const input = new Uint8Array(saltBytes.length + passwordBytes.length);
  input.set(saltBytes);
  input.set(passwordBytes, saltBytes.length);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    input,
  );
  return bytesToBase64(new Uint8Array(hash));
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
