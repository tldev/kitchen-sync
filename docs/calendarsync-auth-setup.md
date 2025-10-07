# CalendarSync Authentication Setup

## Overview

CalendarSync uses [AGE encryption](https://github.com/FiloSottile/age) to store OAuth tokens in an `auth-storage.yaml` file. This document explains our **elegant web-only solution** that automatically sets up CalendarSync authentication without any CLI interaction.

## How CalendarSync Handles Authentication

### What CalendarSync Does:

1. **First Run (Interactive)**:
   - User runs: `CALENDARSYNC_ENCRYPTION_KEY=secret ./calendarsync --config sync.yaml`
   - CalendarSync detects missing OAuth tokens
   - Opens browser for Google OAuth consent flow
   - Stores received OAuth tokens in `auth-storage.yaml` encrypted with AGE
   
2. **Subsequent Runs (Automated)**:
   - CalendarSync reads `auth-storage.yaml`
   - Decrypts tokens using `CALENDARSYNC_ENCRYPTION_KEY`
   - Uses tokens to sync calendars
   - Refreshes access tokens automatically when expired

### Auth Storage File Format:

```yaml
# Encrypted with AGE (starts with "age-encryption.org")
calendars:
  - calendarID: "calendar@example.com"
    oAuth2:
      accessToken: "ya29...."
      refreshToken: "1//..."
      tokenType: "Bearer"
      expiry: "2024-01-01T00:00:00Z"
```

## Challenge: Background Job Execution

**Problem**: Our application runs CalendarSync as background jobs:
- No user present to click "Allow" in OAuth flow
- Can't do interactive authentication
- Already have OAuth tokens from NextAuth

**Options**:

### Option 1: Manual Initial Setup (RECOMMENDED)

Have users authenticate ONCE per Google account:

1. **When user links a new Google account**:
   - Trigger a one-time CalendarSync run interactively
   - User completes OAuth flow
   - CalendarSync creates `auth-storage.yaml` with encrypted tokens
   
2. **Store the auth-storage.yaml file**:
   - Save it to persistent storage (database blob, S3, etc.)
   - Associate it with the Google account
   
3. **Use for all future syncs**:
   - Write `auth-storage.yaml` to disk before each sync job
   - CalendarSync uses existing tokens
   - Automatically refreshes expired access tokens

**Pros**:
- ✅ Works exactly as CalendarSync expects
- ✅ CalendarSync handles token refresh automatically
- ✅ Uses AGE encryption correctly

**Cons**:
- ❌ Requires initial interactive setup
- ❌ Need to store/manage auth-storage.yaml files

### Option 2: Pre-populate auth-storage.yaml (COMPLEX)

Try to create `auth-storage.yaml` ourselves from NextAuth tokens:

**Requirements**:
- Implement AGE encryption in Node.js (need library or shell out to `age` CLI)
- Match CalendarSync's exact YAML structure for `CalendarAuth`
- Handle passphrase-based AGE encryption correctly
- Risk of incompatibility if format changes

**Pros**:
- ✅ No interactive setup needed
- ✅ Fully automated

**Cons**:
- ❌ Complex to implement
- ❌ Must match CalendarSync's encryption exactly
- ❌ Fragile (breaks if CalendarSync changes format)
- ❌ No Node.js AGE library readily available

### Option 3: Fork CalendarSync (NOT RECOMMENDED)

Modify CalendarSync to accept tokens differently:

**Cons**:
- ❌ Have to maintain a fork
- ❌ Miss upstream updates/bug fixes
- ❌ Significant development effort

## ✨ **Our Elegant Web-Only Solution** ✨

We've implemented a fully automated, web-only workflow that requires ZERO CLI interaction from users!

### How It Works

1. **User links Google account** (via NextAuth - existing web UI flow)
   - OAuth tokens automatically stored in database (encrypted with `TOKEN_ENCRYPTION_KEY`)
   
2. **User clicks "Setup CalendarSync Auth"** button
   - Frontend calls `/api/accounts/[accountId]/setup-auth-storage`
   - Backend fetches tokens from database
   - Creates CalendarSync's auth-storage.yaml structure
   - Encrypts it using `age` CLI tool with `CALENDARSYNC_ENCRYPTION_KEY`
   - Stores encrypted content in database (`Account.calendarSyncAuthStorage`)
   
3. **Sync jobs run automatically**
   - Job runner fetches auth storage from database
   - Writes it to temporary file
   - CalendarSync uses it to authenticate
   - Temp file cleaned up after run
   - CalendarSync automatically refreshes expired tokens

### Implementation Details

#### API Endpoint

```
POST /api/accounts/[accountId]/setup-auth-storage
```

- Fetches OAuth tokens from database
- Decrypts them (from NextAuth storage)
- Creates CalendarSync format
- Encrypts using AGE
- Stores in `Account.calendarSyncAuthStorage`

#### UI Component

```tsx
import { SetupAuthStorageButton } from "@/components/setup-auth-storage-button";

<SetupAuthStorageButton 
  accountId={account.id}
  accountEmail={account.email}
  onSuccess={() => {
    // Refresh account list or show success message
  }}
/>
```

#### Job Runner Integration

The job runner automatically:
1. Checks if account has `calendarSyncAuthStorage`
2. Writes it to temp file before each sync
3. CalendarSync reads and uses the tokens
4. Cleans up temp file after execution

## Environment Variables

```bash
# Required for CalendarSync encryption
CALENDARSYNC_ENCRYPTION_KEY="your-32-byte-base64-encoded-key"

# OAuth credentials (in sync.yaml config)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Security Considerations

1. **Two Separate Keys**:
   - `TOKEN_ENCRYPTION_KEY`: Encrypts NextAuth tokens in PostgreSQL (AES-256-GCM)
   - `CALENDARSYNC_ENCRYPTION_KEY`: Encrypts CalendarSync auth storage (AGE)
   
2. **Auth Storage Files**:
   - Already encrypted with AGE
   - Can store in database as-is
   - Decrypted only by CalendarSync binary
   
3. **Token Refresh**:
   - CalendarSync handles refresh automatically
   - No need to sync back to NextAuth tokens
   - Tokens can diverge (this is OK)

## Implementation Status

**✅ Fully Implemented**:
- ✅ YAML config generation with real OAuth client credentials
- ✅ AGE encryption using `age` CLI tool
- ✅ Auth storage creation from NextAuth tokens
- ✅ Database storage (`Account.calendarSyncAuthStorage` field)
- ✅ API endpoint for setup (`/api/accounts/[accountId]/setup-auth-storage`)
- ✅ React component (`SetupAuthStorageButton`)
- ✅ Job runner integration (automatic auth storage injection)
- ✅ Temp file management (write before run, cleanup after)

**Next Steps for Integration**:
1. Run database migration to add `calendarSyncAuthStorage` field
2. Install `age` CLI tool in production environment
3. Add `SetupAuthStorageButton` to account management UI
4. Users click button after linking each Google account

## Installation Requirements

### AGE CLI Tool

The `age` encryption tool must be installed:

**macOS:**
```bash
brew install age
```

**Ubuntu/Debian:**
```bash
apt-get install age
```

**Docker:**
```dockerfile
RUN apt-get update && apt-get install -y age
```

### Database Migration

Add the new field:

```bash
npx prisma migrate dev --name add_calendarsync_auth_storage
```

## User Workflow

1. ✅ User signs in with Google (existing flow)
2. ✅ User links additional Google accounts (existing flow)
3. **NEW**: User clicks "Setup CalendarSync Auth" for each account
4. ✅ User creates sync jobs (existing flow)
5. ✅ Sync jobs run automatically in background
