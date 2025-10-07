import { decryptToken } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

type GoogleCalendarListItem = {
  id?: string | null;
  summary?: string | null;
  summaryOverride?: string | null;
  timeZone?: string | null;
  description?: string | null;
  backgroundColor?: string | null;
  accessRole?: string | null;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[] | null;
};

type OAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type AccountWithTokens = {
  id: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
};

export type CalendarDiscoveryResult = {
  accountId: string;
  providerAccountId: string;
  status: "success" | "skipped" | "error";
  discovered: number;
  stored: number;
  message?: string;
};

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "Missing Google OAuth environment variables. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to discover calendars."
  );
}

function maybeDecryptToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return decryptToken(value);
  } catch (error) {
    return value;
  }
}

async function exchangeRefreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }).toString()
  });

  if (!tokenResponse.ok) {
    const errorBody = await safeJson(tokenResponse);
    throw new Error(
      `Failed to refresh access token (status ${tokenResponse.status}): ${JSON.stringify(errorBody)}`
    );
  }

  const payload = (await tokenResponse.json()) as OAuthTokenResponse;

  if (!payload.access_token) {
    throw new Error("Token response did not include an access_token");
  }

  return payload;
}

async function fetchCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("showHidden", "true");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("minAccessRole", "reader");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errorBody = await safeJson(response);
    throw new Error(
      `Failed to fetch calendars (status ${response.status}): ${JSON.stringify(errorBody)}`
    );
  }

  const data = (await response.json()) as GoogleCalendarListResponse;

  if (!Array.isArray(data.items)) {
    return [];
  }

  return data.items.filter((item): item is GoogleCalendarListItem => Boolean(item));
}

async function upsertCalendarsForAccount(account: AccountWithTokens, items: GoogleCalendarListItem[]) {
  const upserts = items
    .map((item) => {
      const calendarId = item.id ?? undefined;

      if (!calendarId) {
        return null;
      }

      const summary = item.summaryOverride ?? item.summary ?? calendarId;
      const timeZone = item.timeZone ?? "UTC";
      const description = item.description ?? null;
      const color = item.backgroundColor ?? null;
      const accessRole = item.accessRole ?? null;

      return prisma.calendar.upsert({
        where: {
          accountId_googleCalendarId: {
            accountId: account.id,
            googleCalendarId: calendarId
          }
        },
        update: {
          summary,
          timeZone,
          description,
          color,
          accessRole
        },
        create: {
          accountId: account.id,
          googleCalendarId: calendarId,
          summary,
          timeZone,
          description,
          color,
          accessRole
        }
      });
    })
    .filter((operation): operation is ReturnType<typeof prisma.calendar.upsert> => operation !== null);

  if (upserts.length === 0) {
    return 0;
  }

  await prisma.$transaction(upserts);
  return upserts.length;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    return { message: "Failed to parse error response as JSON" };
  }
}

export async function discoverCalendarsForUser(userId: string): Promise<CalendarDiscoveryResult[]> {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "google"
    },
    select: {
      id: true,
      providerAccountId: true,
      refresh_token: true,
      access_token: true
    }
  });

  if (accounts.length === 0) {
    return [];
  }

  const results: CalendarDiscoveryResult[] = [];

  for (const account of accounts) {
    const decryptedAccount: AccountWithTokens = {
      id: account.id,
      providerAccountId: account.providerAccountId,
      refresh_token: maybeDecryptToken(account.refresh_token),
      access_token: maybeDecryptToken(account.access_token)
    };

    if (!decryptedAccount.refresh_token && !decryptedAccount.access_token) {
      results.push({
        accountId: decryptedAccount.id,
        providerAccountId: decryptedAccount.providerAccountId,
        status: "skipped",
        discovered: 0,
        stored: 0,
        message: "No OAuth tokens available for this account"
      });
      continue;
    }

    try {
      const accessToken = decryptedAccount.refresh_token
        ? (await exchangeRefreshToken(decryptedAccount.refresh_token)).access_token!
        : decryptedAccount.access_token;

      if (!accessToken) {
        results.push({
          accountId: decryptedAccount.id,
          providerAccountId: decryptedAccount.providerAccountId,
          status: "error",
          discovered: 0,
          stored: 0,
          message: "Unable to obtain an access token"
        });
        continue;
      }

      const calendars = await fetchCalendars(accessToken);
      const stored = await upsertCalendarsForAccount(decryptedAccount, calendars);

      results.push({
        accountId: decryptedAccount.id,
        providerAccountId: decryptedAccount.providerAccountId,
        status: "success",
        discovered: calendars.length,
        stored
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error during calendar discovery";

      results.push({
        accountId: decryptedAccount.id,
        providerAccountId: decryptedAccount.providerAccountId,
        status: "error",
        discovered: 0,
        stored: 0,
        message
      });
    }
  }

  return results;
}
