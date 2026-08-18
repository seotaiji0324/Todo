const PBKDF2_ALGORITHM = "pbkdf2-sha256";
// Cloudflare workerd rejects PBKDF2 requests above 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

export type PasswordCredentials = {
  passwordHash: string;
  passwordSalt: string;
};

export async function createPasswordCredentials(
  password: string,
): Promise<PasswordCredentials> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await derivePbkdf2Hash(password, salt, PBKDF2_ITERATIONS);

  return {
    passwordHash: `${PBKDF2_ALGORITHM}$${PBKDF2_ITERATIONS}$${bytesToBase64(hash)}`,
    passwordSalt: bytesToBase64(salt),
  };
}

export async function verifyPassword(
  password: string,
  encodedSalt: string,
  storedHash: string,
): Promise<boolean> {
  try {
    const salt = base64ToBytes(encodedSalt);
    const [algorithm, iterationsValue, encodedHash] = storedHash.split("$");

    if (algorithm === PBKDF2_ALGORITHM && iterationsValue && encodedHash) {
      const iterations = Number(iterationsValue);
      if (
        !Number.isSafeInteger(iterations) ||
        iterations !== PBKDF2_ITERATIONS
      ) {
        return false;
      }

      const actual = await derivePbkdf2Hash(password, salt, iterations);
      return constantTimeEqual(actual, base64ToBytes(encodedHash));
    }

    const actual = await deriveLegacySha256Hash(password, salt);
    return constantTimeEqual(actual, base64ToBytes(storedHash));
  } catch {
    return false;
  }
}

async function derivePbkdf2Hash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt,
    },
    passwordKey,
    PASSWORD_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

async function deriveLegacySha256Hash(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  const input = new Uint8Array(salt.length + passwordBytes.length);
  input.set(salt);
  input.set(passwordBytes, salt.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}

function constantTimeEqual(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
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
