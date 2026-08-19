import { env } from "cloudflare:workers";

type D1Parameter = string | number | null;

type D1ApiResponse<Row> = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    results?: Row[];
  }>;
};

function externalD1Config() {
  const bindings = env as unknown as Record<string, unknown>;
  const accountId = bindings.CLOUDFLARE_D1_ACCOUNT_ID;
  const databaseId = bindings.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = bindings.CLOUDFLARE_D1_API_TOKEN;

  if (
    typeof accountId !== "string" ||
    typeof databaseId !== "string" ||
    typeof apiToken !== "string" ||
    !accountId ||
    !databaseId ||
    !apiToken
  ) {
    return null;
  }

  return { accountId, databaseId, apiToken };
}

export function usesExternalCloudflareD1() {
  return externalD1Config() !== null;
}

export async function queryExternalCloudflareD1<Row>(
  sql: string,
  params: D1Parameter[] = [],
): Promise<Row[]> {
  const config = externalD1Config();
  if (!config) {
    throw new Error("External Cloudflare D1 is not configured.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/d1/database/${encodeURIComponent(config.databaseId)}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = (await response.json()) as D1ApiResponse<Row>;
  const query = payload.result?.[0];

  if (!response.ok || !payload.success || query?.success === false) {
    const detail = payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(
      detail
        ? `External Cloudflare D1 query failed: ${detail}`
        : "External Cloudflare D1 query failed.",
    );
  }

  return query?.results ?? [];
}
