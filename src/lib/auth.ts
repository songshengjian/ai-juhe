import { randomUUID } from "node:crypto";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

const credentialsSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login"
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60
  },
  providers: [
    CredentialsProvider({
      name: "邮箱",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }
        });
        if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split("@")[0] ?? "用户"
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.sessionId = randomUUID();
        const redis = await getRedisClient();
        if (redis) {
          await redis
            .setEx(`auth-session:${token.sessionId}`, 30 * 24 * 60 * 60, user.id)
            .catch(() => undefined);
        }
      } else if (token.userId && token.sessionId) {
        const redis = await getRedisClient();
        if (redis) {
          const activeUser = await redis
            .get(`auth-session:${token.sessionId}`)
            .catch(() => token.userId ?? null);
          if (activeUser !== token.userId) {
            delete token.userId;
            delete token.sessionId;
          } else {
            await redis
              .expire(`auth-session:${token.sessionId}`, 30 * 24 * 60 * 60)
              .catch(() => undefined);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    }
  },
  events: {
    async signOut({ token }) {
      if (token?.sessionId) {
        const redis = await getRedisClient();
        await redis?.del(`auth-session:${token.sessionId}`).catch(() => undefined);
      }
    }
  }
};

export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
