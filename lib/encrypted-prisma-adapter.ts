import type { Adapter, AdapterAccount, AdapterUser, AdapterSession } from "next-auth/adapters";
import type { Prisma, PrismaClient } from "@prisma/client";
import { encryptToken, decryptToken } from "@/lib/encryption";

const TOKEN_FIELDS: (keyof AdapterAccount)[] = [
  "access_token",
  "refresh_token",
  "id_token",
  "session_state",
  "oauth_token",
  "oauth_token_secret"
];

function encryptAccountTokens(account: AdapterAccount): AdapterAccount {
  const encrypted: AdapterAccount = { ...account };

  for (const field of TOKEN_FIELDS) {
    const value = account[field];
    if (typeof value === "string" && value.length > 0) {
      encrypted[field] = encryptToken(value);
    }
  }

  return encrypted;
}

function decryptAccountTokens<T extends { [key: string]: unknown }>(account: T): T {
  const decrypted: T = { ...account };

  for (const field of TOKEN_FIELDS) {
    const value = decrypted[field as keyof T];
    if (typeof value === "string" && value.length > 0) {
      try {
        decrypted[field as keyof T] = decryptToken(value) as T[keyof T];
      } catch (error) {
        // If decryption fails we leave the encrypted value to surface the error downstream
      }
    }
  }

  return decrypted;
}

export function createEncryptedPrismaAdapter(prisma: PrismaClient): Adapter {
  return {
    async createUser(data: Prisma.UserCreateInput) {
      const user = await prisma.user.create({ data });
      return user as AdapterUser;
    },
    async getUser(id: string) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user as AdapterUser | null;
    },
    async getUserByEmail(email: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      return user as AdapterUser | null;
    },
    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true }
      });

      if (!account) {
        return null;
      }

      return account.user as AdapterUser;
    },
    async updateUser(data: Partial<Prisma.UserUpdateInput> & { id: string }) {
      const { id, ...updateData } = data;
      if (!id) {
        throw new Error("Cannot update user without id");
      }

      const user = await prisma.user.update({ where: { id }, data: updateData });
      return user as AdapterUser;
    },
    async deleteUser(id: string) {
      await prisma.user.delete({ where: { id } });
    },
    async linkAccount(account: AdapterAccount) {
      const { id, ...rest } = encryptAccountTokens(account);
      const createData = rest as Prisma.AccountUncheckedCreateInput;
      const updateData = rest as Prisma.AccountUncheckedUpdateInput;

      const storedAccount = await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId
          }
        },
        create: createData,
        update: updateData
      });

      return decryptAccountTokens(storedAccount) as AdapterAccount;
    },
    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      return prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } }
      });
    },
    async createSession(data: { sessionToken: string; userId: string; expires: Date }) {
      const session = await prisma.session.create({ 
        data: {
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires
        }
      });
      return session as AdapterSession;
    },
    async getSessionAndUser(sessionToken: string) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      });

      if (!session) {
        return null;
      }

      return {
        session: session as AdapterSession,
        user: session.user as AdapterUser
      };
    },
    async updateSession(data: Partial<Prisma.SessionUpdateInput> & { sessionToken: string }) {
      const { sessionToken, ...updateData } = data;

      if (!sessionToken) {
        throw new Error("Cannot update session without sessionToken");
      }

      const session = await prisma.session.update({
        where: { sessionToken },
        data: updateData
      });
      return session as AdapterSession;
    },
    async deleteSession(sessionToken: string) {
      await prisma.session.delete({ where: { sessionToken } });
    },
    async createVerificationToken(data: Prisma.VerificationTokenCreateInput) {
      return prisma.verificationToken.create({ data });
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token } }
        });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    }
  } satisfies Adapter;
}

function isRecordNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Prisma.PrismaClientKnownRequestError).code === "P2025"
  );
}
