const WEBFLOW_API = "https://api.webflow.com";
const TOKEN_URL = `${WEBFLOW_API}/oauth/access_token`;

export class WebflowApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "WebflowApiError";
  }
}

export async function exchangeWebflowCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const payloads: Record<string, string>[] = [
    {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    },
    {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
    },
  ];
  const urls = [TOKEN_URL, `${WEBFLOW_API}/oauth/token`];

  let lastMessage = "Webflow token exchange failed";
  let lastStatus: number | undefined;
  for (const url of urls) {
    for (const payload of payloads) {
      for (const asJson of [true, false]) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": asJson ? "application/json" : "application/x-www-form-urlencoded",
          },
          body: asJson ? JSON.stringify(payload) : new URLSearchParams(payload),
        });
        const body = (await response.json().catch(() => ({}))) as {
          access_token?: string;
          token?: string;
          scope?: string;
          error?: string;
          error_description?: string;
        };
        const accessToken = body.access_token || body.token;
        if (response.ok && accessToken) {
          return { accessToken, scope: body.scope ?? "" };
        }
        lastStatus = response.status;
        lastMessage =
          body.error_description || body.error || `Webflow token exchange failed (${response.status})`;
      }
    }
  }

  throw new WebflowApiError(lastMessage, lastStatus);
}

export async function webflowGet<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${WEBFLOW_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new WebflowApiError(`Webflow GET ${path} failed (${response.status})`, response.status);
  }
  return (await response.json()) as T;
}

export async function webflowSend<T>(
  accessToken: string,
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<T> {
  const response = await fetch(`${WEBFLOW_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new WebflowApiError(
      `Webflow ${method} ${path} failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** DELETE with no body (e.g. remove App-applied site Custom Code). */
export async function webflowDelete(accessToken: string, path: string): Promise<void> {
  const response = await fetch(`${WEBFLOW_API}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new WebflowApiError(
      `Webflow DELETE ${path} failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      response.status,
    );
  }
}
