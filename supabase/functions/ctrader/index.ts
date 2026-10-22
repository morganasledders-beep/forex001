const SITE_URL = "https://morganasledders-beep.github.io/forex001/";
const AUTH_URL = "https://id.ctrader.com/my/settings/openapi/grantingaccess/";
const TOKEN_URL = "https://openapi.ctrader.com/apps/token";
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

const PAIRS: Record<string, string> = {
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  USDCHF: "USDCHF",
};

const PERIODS: Record<string, { value: number; milliseconds: number }> = {
  "1m": { value: 1, milliseconds: 60_000 },
  "5m": { value: 5, milliseconds: 300_000 },
  "15m": { value: 7, milliseconds: 900_000 },
  "30m": { value: 8, milliseconds: 1_800_000 },
  "1h": { value: 9, milliseconds: 3_600_000 },
  "4h": { value: 10, milliseconds: 14_400_000 },
  "1d": { value: 12, milliseconds: 86_400_000 },
};

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
    },
  });
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function callbackPage(success: boolean): Response {
  const destination = new URL(SITE_URL);
  destination.searchParams.set("ctrader", success ? "connected" : "error");
  const message = success
    ? "cTrader was authorized. Return to FOREX001 to choose the account and view rates."
    : "cTrader could not be connected. Return to FOREX001 and try again.";
  return htmlResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FOREX001 cTrader</title><body style="font:16px system-ui;background:#07101f;color:#edf4ff;padding:2rem"><p>${message}</p><p><a style="color:#64b4ff" href="${destination.href}">Return to FOREX001</a></p><script>setTimeout(()=>location.replace(${JSON.stringify(destination.href)}),1200)</script></body></html>`);
}

function allowedOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  if (
    origin === "https://morganasledders-beep.github.io" ||
    /^http:\/\/localhost:\d+$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
  ) return origin;
  throw new Error("This website origin is not allowed.");
}

function requiredUserToken(request: Request): string {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) throw new Error("Sign in to FOREX001 before connecting cTrader.");
  return match[1];
}

async function authenticatedUser(request: Request): Promise<{ id: string }> {
  const token = requiredUserToken(request);
  const response = await fetch(`${getEnv("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      apikey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Your FOREX001 session is invalid or expired. Sign in again.");
  const user = await response.json();
  if (typeof user.id !== "string") throw new Error("Supabase did not return an authenticated user.");
  return { id: user.id };
}

async function stateSignature(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getEnv("CTRADER_CLIENT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

async function makeState(userId: string): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    userId,
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  })));
  return `${payload}.${await stateSignature(payload)}`;
}

async function verifyState(state: string): Promise<string> {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) throw new Error("The cTrader authorization state is invalid.");
  const expected = await stateSignature(payload);
  let mismatch = expected.length ^ signature.length;
  const length = Math.max(expected.length, signature.length);
  for (let index = 0; index < length; index++) {
    mismatch |= (expected.charCodeAt(index) || 0) ^ (signature.charCodeAt(index) || 0);
  }
  if (mismatch !== 0) throw new Error("The cTrader authorization state is invalid.");
  let value: { userId?: unknown; expiresAt?: unknown };
  try {
    value = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    throw new Error("The cTrader authorization state is invalid.");
  }
  if (
    typeof value.userId !== "string" ||
    typeof value.expiresAt !== "number" ||
    value.expiresAt < Date.now()
  ) throw new Error("The cTrader authorization request expired. Start again from FOREX001.");
  return value.userId;
}

function encryptionKey(): Promise<CryptoKey> {
  const raw = decodeBase64(getEnv("CTRADER_ENCRYPTION_KEY"));
  if (raw.length !== 32) throw new Error("CTRADER_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptPayload(payload: unknown): Promise<{ encrypted_payload: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return { encrypted_payload: encodeBase64(new Uint8Array(ciphertext)), iv: encodeBase64(iv) };
}

async function decryptPayload(encrypted: string, iv: string): Promise<ConnectionData> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(decodeBase64(iv)) },
      await encryptionKey(),
      toArrayBuffer(decodeBase64(encrypted)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("The saved cTrader connection could not be decrypted. Reconnect the account.");
  }
}

type CTraderAccount = {
  ctidTraderAccountId: string;
  isLive: boolean;
  traderLogin?: string;
  brokerTitleShort?: string;
};

type ConnectionData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accounts?: CTraderAccount[];
};

async function saveConnection(userId: string, connection: ConnectionData): Promise<void> {
  const encrypted = await encryptPayload(connection);
  const response = await fetch(
    `${getEnv("SUPABASE_URL")}/rest/v1/ctrader_connections?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
        Authorization: `Bearer ${getEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: userId, ...encrypted, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error("Could not safely save the cTrader connection.");
}

async function loadConnection(userId: string): Promise<ConnectionData | null> {
  const url = new URL(`${getEnv("SUPABASE_URL")}/rest/v1/ctrader_connections`);
  url.searchParams.set("select", "encrypted_payload,iv");
  url.searchParams.set("user_id", `eq.${userId}`);
  const response = await fetch(url, {
    headers: {
      apikey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${getEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
  if (!response.ok) throw new Error("Could not load the cTrader connection.");
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return decryptPayload(rows[0].encrypted_payload, rows[0].iv);
}

async function deleteConnection(userId: string): Promise<void> {
  const url = new URL(`${getEnv("SUPABASE_URL")}/rest/v1/ctrader_connections`);
  url.searchParams.set("user_id", `eq.${userId}`);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${getEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
  if (!response.ok) throw new Error("Could not remove the saved cTrader connection.");
}

async function exchangeToken(form: URLSearchParams): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await response.json();
  if (!response.ok || typeof body.accessToken !== "string" || typeof body.refreshToken !== "string") {
    throw new Error("cTrader rejected the authorization. Check the registered callback URL and app settings.");
  }
  return body;
}

async function refreshConnection(connection: ConnectionData): Promise<ConnectionData> {
  if (connection.expiresAt > Date.now() + 60_000) return connection;
  const token = await exchangeToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: getEnv("CTRADER_CLIENT_ID"),
    client_secret: getEnv("CTRADER_CLIENT_SECRET"),
  }));
  return {
    ...connection,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
}

class CTraderSocket {
  private readonly socket: WebSocket;
  private readonly waiting = new Map<string, {
    resolve: (payload: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      let message: {
        clientMsgId?: string;
        payloadType?: number;
        payload?: Record<string, unknown>;
      };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (typeof message.clientMsgId !== "string") return;
      const waiter = this.waiting.get(message.clientMsgId);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      this.waiting.delete(message.clientMsgId);
      if (message.payloadType === 2142) {
        waiter.reject(new Error("cTrader rejected a read-only market-data request."));
      } else {
        waiter.resolve(message.payload ?? {});
      }
    });
    socket.addEventListener("error", () => this.rejectAll(new Error("Could not communicate with the cTrader API.")));
    socket.addEventListener("close", () => this.rejectAll(new Error("The cTrader API connection closed unexpectedly.")));
  }

  static async open(host: string): Promise<CTraderSocket> {
    const socket = new WebSocket(`wss://${host}:5036`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error("Timed out connecting to the cTrader API."));
      }, 8_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Could not connect to the cTrader API.")); }, { once: true });
    });
    return new CTraderSocket(socket);
  }

  request(type: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const clientMsgId = crypto.randomUUID();
    const response = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(clientMsgId);
        reject(new Error("cTrader did not respond in time. Try again."));
      }, 10_000);
      this.waiting.set(clientMsgId, { resolve, reject, timer });
    });
    try {
      this.socket.send(JSON.stringify({
        clientMsgId,
        payloadType: type,
        payload,
      }));
    } catch (error) {
      const waiter = this.waiting.get(clientMsgId);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.waiting.delete(clientMsgId);
      }
      throw error;
    }
    return response;
  }

  close(): void {
    this.socket.close();
  }

  private rejectAll(error: Error): void {
    for (const [type, waiter] of this.waiting) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
      this.waiting.delete(type);
    }
  }
}

async function withCTrader<T>(
  host: string,
  accessToken: string,
  accountId: string | null,
  operation: (socket: CTraderSocket, selectedAccountId: string) => Promise<T>,
): Promise<T> {
  const socket = await CTraderSocket.open(host);
  try {
    await socket.request(2100, {
      clientId: getEnv("CTRADER_CLIENT_ID"),
      clientSecret: getEnv("CTRADER_CLIENT_SECRET"),
    });
    const accountsResponse = await socket.request(2149, { accessToken });
    const accounts = Array.isArray(accountsResponse.ctidTraderAccount)
      ? accountsResponse.ctidTraderAccount as CTraderAccount[]
      : [];
    const account = accountId
      ? accounts.find((item) => String(item.ctidTraderAccountId) === accountId)
      : accounts[0];
    if (!account) throw new Error("No cTrader account was authorized for this connection.");
    await socket.request(2102, {
      ctidTraderAccountId: String(account.ctidTraderAccountId),
      accessToken,
    });
    return await operation(socket, String(account.ctidTraderAccountId));
  } finally {
    socket.close();
  }
}

function safeAccounts(response: Record<string, unknown>): CTraderAccount[] {
  const raw = response.ctidTraderAccount;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const account = item as Record<string, unknown>;
    if (
      account.ctidTraderAccountId === undefined ||
      typeof account.isLive !== "boolean"
    ) return [];
    return [{
      ctidTraderAccountId: String(account.ctidTraderAccountId),
      isLive: account.isLive,
      ...(typeof account.traderLogin === "string" || typeof account.traderLogin === "number"
        ? { traderLogin: String(account.traderLogin) }
        : {}),
      ...(typeof account.brokerTitleShort === "string"
        ? { brokerTitleShort: account.brokerTitleShort }
        : {}),
    }];
  });
}

async function loadAccounts(connection: ConnectionData): Promise<CTraderAccount[]> {
  const byId = new Map<string, CTraderAccount>();
  const errors: Error[] = [];
  for (const host of ["live.ctraderapi.com", "demo.ctraderapi.com"]) {
    let socket: CTraderSocket | null = null;
    try {
      socket = await CTraderSocket.open(host);
      await socket.request(2100, {
        clientId: getEnv("CTRADER_CLIENT_ID"),
        clientSecret: getEnv("CTRADER_CLIENT_SECRET"),
      });
      const response = await socket.request(2149, { accessToken: connection.accessToken });
      for (const account of safeAccounts(response)) byId.set(account.ctidTraderAccountId, account);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error("Could not list cTrader accounts."));
    } finally {
      socket?.close();
    }
  }
  if (byId.size === 0 && errors.length === 2) {
    throw new Error("Could not retrieve authorized cTrader accounts. Confirm the app has read-only accounts access.");
  }
  return [...byId.values()];
}

function marketData(
  connection: ConnectionData,
  accountId: string,
  symbol: string,
  timeframe: string,
): Promise<Record<string, unknown>> {
  const period = PERIODS[timeframe];
  const pair = PAIRS[symbol];
  if (!period || !pair) throw new Error("Choose a supported forex pair and timeframe.");
  const account = connection.accounts?.find((item) => item.ctidTraderAccountId === accountId);
  if (!account) throw new Error("Choose an authorized cTrader account first.");
  const host = account.isLive ? "live.ctraderapi.com" : "demo.ctraderapi.com";
  return withCTrader(host, connection.accessToken, accountId, async (socket, selectedAccountId) => {
    const symbols = await socket.request(2114, { ctidTraderAccountId: selectedAccountId });
    const available = Array.isArray(symbols.symbol) ? symbols.symbol as Record<string, unknown>[] : [];
    const matching = available.filter((item) => {
      const name = String(item.symbolName ?? "").toUpperCase().replace(/[^A-Z]/g, "");
      return name === pair || name.startsWith(pair);
    });
    const instrument = matching.find((item) => item.enabled === true) ?? matching[0];
    if (!instrument || instrument.symbolId === undefined) {
      throw new Error(`${symbol} is not available in the selected cTrader account.`);
    }
    const now = Date.now();
    const response = await socket.request(2137, {
      ctidTraderAccountId: selectedAccountId,
      fromTimestamp: now - period.milliseconds * 100,
      toTimestamp: now,
      period: period.value,
      symbolId: String(instrument.symbolId),
      count: 100,
    });
    const trendbars = Array.isArray(response.trendbar) ? response.trendbar as Record<string, unknown>[] : [];
    const candles = trendbars.flatMap((bar) => {
      const low = Number(bar.low);
      const deltaOpen = Number(bar.deltaOpen ?? 0);
      const deltaClose = Number(bar.deltaClose ?? 0);
      const deltaHigh = Number(bar.deltaHigh ?? 0);
      const timestamp = Number(bar.utcTimestampInMinutes);
      if (
        !Number.isFinite(low) ||
        !Number.isFinite(deltaOpen) ||
        !Number.isFinite(deltaClose) ||
        !Number.isFinite(deltaHigh) ||
        !Number.isFinite(timestamp)
      ) return [];
      return [{
        time: timestamp * 60_000,
        open: (low + deltaOpen) / 100_000,
        low: low / 100_000,
        high: (low + deltaHigh) / 100_000,
        close: (low + deltaClose) / 100_000,
        volume: Number(bar.volume ?? 0),
      }];
    }).sort((left, right) => left.time - right.time);
    if (candles.length === 0) throw new Error(`cTrader returned no candle history for ${symbol}.`);
    return {
      symbol,
      brokerSymbol: String(instrument.symbolName ?? symbol),
      timeframe,
      source: "cTrader Open API",
      accountId: selectedAccountId,
      candles,
      price: candles[candles.length - 1].close,
      updatedAt: new Date().toISOString(),
    };
  });
}

async function handleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.has("error")) return callbackPage(false);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return callbackPage(false);
  const userId = await verifyState(state);
  const redirectUri = `${getEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/ctrader`;
  const token = await exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: getEnv("CTRADER_CLIENT_ID"),
    client_secret: getEnv("CTRADER_CLIENT_SECRET"),
  }));
  await saveConnection(userId, {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + token.expiresIn * 1000,
    accounts: [],
  });
  return callbackPage(true);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    let origin = "";
    try {
      origin = allowedOrigin(request);
    } catch {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { headers: { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin } });
  }

  const isCallback = new URL(request.url).searchParams.has("code") ||
    new URL(request.url).searchParams.has("error");
  if (isCallback) {
    try {
      return await handleCallback(request);
    } catch (error) {
      console.error("cTrader OAuth callback failed", error);
      return callbackPage(false);
    }
  }

  let origin: string;
  try {
    origin = allowedOrigin(request);
  } catch {
    return new Response("Origin not allowed.", { status: 403 });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json();
    if (!body || typeof body.action !== "string") {
      return jsonResponse({ error: "A valid action is required." }, 400, origin);
    }

    if (body.action === "start") {
      const redirectUri = `${getEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/ctrader`;
      const url = new URL(AUTH_URL);
      url.searchParams.set("client_id", getEnv("CTRADER_CLIENT_ID"));
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", "accounts");
      url.searchParams.set("product", "web");
      url.searchParams.set("state", await makeState(user.id));
      return jsonResponse({ authorizationUrl: url.toString() }, 200, origin);
    }

    if (body.action === "status") {
      const existing = await loadConnection(user.id);
      if (!existing) return jsonResponse({ connected: false, accounts: [] }, 200, origin);
      const connection = await refreshConnection(existing);
      connection.accounts = await loadAccounts(connection);
      await saveConnection(user.id, connection);
      return jsonResponse({
        connected: true,
        accounts: connection.accounts.map((account) => ({
          ...account,
          label: `${account.brokerTitleShort ?? "cTrader"} · ${account.isLive ? "Live" : "Demo"} · ${account.traderLogin ?? account.ctidTraderAccountId}`,
        })),
      }, 200, origin);
    }

    if (body.action === "market") {
      if (
        typeof body.accountId !== "string" ||
        typeof body.symbol !== "string" ||
        typeof body.timeframe !== "string"
      ) return jsonResponse({ error: "Account, symbol, and timeframe are required." }, 400, origin);
      const existing = await loadConnection(user.id);
      if (!existing) return jsonResponse({ error: "Connect your cTrader account first." }, 409, origin);
      const connection = await refreshConnection(existing);
      if (connection !== existing) await saveConnection(user.id, connection);
      const result = await marketData(connection, body.accountId, body.symbol, body.timeframe);
      return jsonResponse(result, 200, origin);
    }

    if (body.action === "disconnect") {
      await deleteConnection(user.id);
      return jsonResponse({ connected: false, accounts: [] }, 200, origin);
    }

    return jsonResponse({ error: "Unsupported cTrader action." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The cTrader request failed.";
    console.error("cTrader request failed", message);
    const status = /Sign in|session is invalid/i.test(message) ? 401 : 400;
    return jsonResponse({ error: message }, status, origin);
  }
});
