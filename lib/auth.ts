import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createEncryptedPrismaAdapter } from "@/lib/encrypted-prisma-adapter";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "Missing Google OAuth environment variables. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to use Google authentication."
  );
}

if (!nextAuthSecret) {
  throw new Error(
    "Missing NEXTAUTH_SECRET environment variable. Set NEXTAUTH_SECRET to secure NextAuth sessions."
  );
}

export const authOptions: NextAuthOptions = {
  adapter: createEncryptedPrismaAdapter(prisma),
  secret: nextAuthSecret,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/signin"
  },
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token }) {
      if (token.sub) {
        token.userId = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
      }
      return session;
    }
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  }
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
