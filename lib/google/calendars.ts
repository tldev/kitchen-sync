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

function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    throw new Error(
      "Missing Google OAuth environment variables. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to discover calendars."
    );
  }

  return { clientId: googleClientId, clientSecret: googleClientSecret };
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
  const { clientId, clientSecret } = getGoogleCredentials();
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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

async function processAccountDiscovery(account: AccountWithTokens): Promise<CalendarDiscoveryResult> {
  if (!account.refresh_token && !account.access_token) {
    return {
      accountId: account.id,
      providerAccountId: account.providerAccountId,
      status: "skipped",
      discovered: 0,
      stored: 0,
      message: "No OAuth tokens available for this account"
    };
  }

  try {
    const accessToken = account.refresh_token
      ? (await exchangeRefreshToken(account.refresh_token)).access_token!
      : account.access_token;

    if (!accessToken) {
      return {
        accountId: account.id,
        providerAccountId: account.providerAccountId,
        status: "error",
        discovered: 0,
        stored: 0,
        message: "Unable to obtain an access token"
      };
    }

    const calendars = await fetchCalendars(accessToken);
    const stored = await upsertCalendarsForAccount(account, calendars);

    return {
      accountId: account.id,
      providerAccountId: account.providerAccountId,
      status: "success",
      discovered: calendars.length,
      stored
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during calendar discovery";

    return {
      accountId: account.id,
      providerAccountId: account.providerAccountId,
      status: "error",
      discovered: 0,
      stored: 0,
      message
    };
  }
}

export async function discoverCalendarsForAccount(userId: string, accountId: string): Promise<CalendarDiscoveryResult> {
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
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

  if (!account) {
    throw new Error("Account not found or access denied");
  }

  const decryptedAccount: AccountWithTokens = {
    id: account.id,
    providerAccountId: account.providerAccountId,
    refresh_token: maybeDecryptToken(account.refresh_token),
    access_token: maybeDecryptToken(account.access_token)
  };

  return processAccountDiscovery(decryptedAccount);
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

    const result = await processAccountDiscovery(decryptedAccount);
    results.push(result);
  }

  return results;
}

export type LiveCalendar = {
  id: string;
  googleCalendarId: string;
  summary: string;
  timeZone: string;
  description: string | null;
  color: string | null;
  accessRole: string | null;
  accountId: string;
  providerAccountId: string;
};

/**
 * Fetches calendars directly from Google's API and ensures they're stored in the database.
 * This ensures the dropdown always shows current data from Google while maintaining valid database references.
 */
export async function fetchLiveCalendarsForUser(userId: string): Promise<LiveCalendar[]> {
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

  const allCalendars: LiveCalendar[] = [];

  for (const account of accounts) {
    const decryptedRefreshToken = maybeDecryptToken(account.refresh_token);
    const decryptedAccessToken = maybeDecryptToken(account.access_token);

    if (!decryptedRefreshToken && !decryptedAccessToken) {
      continue;
    }

    try {
      const accessToken = decryptedRefreshToken
        ? (await exchangeRefreshToken(decryptedRefreshToken)).access_token!
        : decryptedAccessToken;

      if (!accessToken) {
        continue;
      }

      const calendars = await fetchCalendars(accessToken);

      // Upsert each calendar to ensure we have valid database IDs
      for (const item of calendars) {
        const googleCalendarId = item.id;
        if (!googleCalendarId) {
          continue;
        }

        const summary = item.summaryOverride ?? item.summary ?? googleCalendarId;
        const timeZone = item.timeZone ?? "UTC";
        const description = item.description ?? null;
        const color = item.backgroundColor ?? null;
        const accessRole = item.accessRole ?? null;

        // Upsert to database to get/create the actual UUID
        const dbCalendar = await prisma.calendar.upsert({
          where: {
            accountId_googleCalendarId: {
              accountId: account.id,
              googleCalendarId
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
            googleCalendarId,
            summary,
            timeZone,
            description,
            color,
            accessRole
          },
          select: {
            id: true
          }
        });

        allCalendars.push({
          id: dbCalendar.id, // Use the actual database UUID
          googleCalendarId,
          summary,
          timeZone,
          description,
          color,
          accessRole,
          accountId: account.id,
          providerAccountId: account.providerAccountId
        });
      }
    } catch (error) {
      // Skip accounts with errors and continue with others
      console.error(`Failed to fetch calendars for account ${account.id}:`, error);
      continue;
    }
  }

  return allCalendars;
}
