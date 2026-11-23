import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

const secret = process.env.BETTER_AUTH_SECRET;

if (process.env.NODE_ENV === "production" && !secret) {
  throw new Error("BETTER_AUTH_SECRET mora biti podešen u produkciji.");
}

export const auth = betterAuth({
  appName: "Finanse",
  secret: secret ?? "finanse-local-development-secret-change-before-deploy",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-up/email") return;

      const existingOwners = await prisma.user.count();
      if (existingOwners > 0) {
        throw new APIError("FORBIDDEN", {
          message: "Vlasnički nalog je već podešen.",
        });
      }
    }),
  },
  advanced: {
    database: { joins: true },
  },
  plugins: [
    passkey({
      rpName: "Finanse",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    }),
    nextCookies(),
  ],
});

export async function ownerExists() {
  return (await prisma.user.count()) > 0;
}
