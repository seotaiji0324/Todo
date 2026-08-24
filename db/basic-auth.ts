import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { verifyPassword } from "./password-crypto";
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

  const authorized = await verifyPassword(
    credentials.password,
    member.passwordSalt,
    member.passwordHash,
  );
  return authorized ? member : null;
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

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
