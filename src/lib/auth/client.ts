"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. It only ever calls the server auth endpoints; no secret,
 * provider token or session material is held on the client.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
});

export const { signIn, signOut, useSession } = authClient;
