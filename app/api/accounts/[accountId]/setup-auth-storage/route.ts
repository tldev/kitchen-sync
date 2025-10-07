import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuthStorageFile, isAgeAvailable, type AccountTokens } from "@/lib/calendarsync/auth-storage";
import { decryptToken } from "@/lib/encryption";

/**
 * POST /api/accounts/[accountId]/setup-auth-storage
 * 
 * Generates and stores the CalendarSync auth-storage.yaml file for an account.
 * This is called automatically after account linking or can be triggered manually.
 * 
 * Process:
 * 1. Fetches account and associated calendars
 * 2. Decrypts OAuth tokens from database
 * 3. Creates auth-storage.yaml in CalendarSync format
 * 4. Encrypts it using AGE with CALENDARSYNC_ENCRYPTION_KEY
 * 5. Stores encrypted content in database
 */
export async function POST(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { accountId } = params;

    // Check if age CLI is available
    const ageAvailable = await isAgeAvailable();
    if (!ageAvailable) {
      return NextResponse.json(
        {
          error: "Age encryption tool not available",
          message: "The 'age' command-line tool is required but not found. Please install it: https://github.com/FiloSottile/age",
        },
        { status: 500 }
      );
    }

    // Fetch account with calendars
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      include: {
        calendars: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if account has necessary tokens
    if (!account.refresh_token) {
      return NextResponse.json(
        {
          error: "Account missing refresh token",
          message: "This account doesn't have a refresh token. Please re-link your Google account.",
        },
        { status: 400 }
      );
    }

    // Decrypt tokens
    const accessToken = account.access_token ? decryptToken(account.access_token) : null;
    const refreshToken = decryptToken(account.refresh_token);

    // If we have calendars, create auth storage for each calendar
    // Otherwise, use the account's email or providerAccountId as the calendar ID
    const accountTokens: AccountTokens[] = [];

    if (account.calendars.length > 0) {
      // Create entry for each calendar
      for (const calendar of account.calendars) {
        accountTokens.push({
          calendarId: calendar.googleCalendarId,
          accessToken: accessToken ?? "",
          refreshToken,
          expiresAt: account.expires_at ?? undefined,
          tokenType: account.token_type ?? undefined,
        });
      }
    } else {
      // No calendars discovered yet - create a single entry using email or account ID
      accountTokens.push({
        calendarId: account.email || account.providerAccountId,
        accessToken: accessToken ?? "",
        refreshToken,
        expiresAt: account.expires_at ?? undefined,
        tokenType: account.token_type ?? undefined,
      });
    }

    // Create encrypted auth storage
    const encryptedAuthStorage = await createAuthStorageFile(accountTokens);

    // Store in database
    await prisma.account.update({
      where: { id: accountId },
      data: {
        calendarSyncAuthStorage: encryptedAuthStorage,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Auth storage created successfully",
      calendarCount: accountTokens.length,
    });

  } catch (error) {
    console.error("[setup-auth-storage] Error:", error);
    
    return NextResponse.json(
      {
        error: "Failed to create auth storage",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounts/[accountId]/setup-auth-storage
 * 
 * Checks the status of the auth storage for an account.
 */
export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { accountId } = params;

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      select: {
        id: true,
        email: true,
        calendarSyncAuthStorage: true,
        calendars: {
          select: {
            id: true,
            googleCalendarId: true,
            summary: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if age CLI is available
    const ageAvailable = await isAgeAvailable();

    return NextResponse.json({
      hasAuthStorage: !!account.calendarSyncAuthStorage,
      ageAvailable,
      calendarCount: account.calendars.length,
      email: account.email,
    });

  } catch (error) {
    console.error("[setup-auth-storage] GET Error:", error);
    
    return NextResponse.json(
      {
        error: "Failed to check auth storage status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
