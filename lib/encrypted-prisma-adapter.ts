import type { Adapter, AdapterAccount } from "next-auth/adapters";
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
    async createUser(data) {
      return prisma.user.create({ data });
    },
    async getUser(id) {
      return prisma.user.findUnique({ where: { id } });
    },
    async getUserByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true }
      });

      if (!account) {
        return null;
      }

      return account.user;
    },
    async updateUser(data) {
      const { id, ...updateData } = data;
      if (!id) {
        throw new Error("Cannot update user without id");
      }

      return prisma.user.update({ where: { id }, data: updateData });
    },
    async deleteUser(id) {
      return prisma.user.delete({ where: { id } });
    },
    async linkAccount(account) {
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
    async unlinkAccount({ provider, providerAccountId }) {
      return prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } }
      });
    },
    async createSession(data) {
      return prisma.session.create({ data });
    },
    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      });

      if (!session) {
        return null;
      }

      return {
        session,
        user: session.user
      };
    },
    async updateSession(data) {
      const { sessionToken, ...updateData } = data;

      if (!sessionToken) {
        throw new Error("Cannot update session without sessionToken");
      }

      return prisma.session.update({
        where: { sessionToken },
        data: updateData
      });
    },
    async deleteSession(sessionToken) {
      return prisma.session.delete({ where: { sessionToken } });
    },
    async createVerificationToken(data) {
      return prisma.verificationToken.create({ data });
    },
    async useVerificationToken({ identifier, token }) {
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
    },
    async updateAccount(account) {
      const { provider, providerAccountId } = account;
      const { id, ...rest } = encryptAccountTokens(account);
      const data = rest as Prisma.AccountUncheckedUpdateInput;

      return decryptAccountTokens(
        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId
            }
          },
          data
        })
      ) as AdapterAccount;
    },
    async getAccount(provider_providerAccountId) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId }
      });

      if (!account) {
        return null;
      }

      return decryptAccountTokens(account) as AdapterAccount;
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
