import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "sh_session";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me");
}

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

export async function makeSession() {
  return new SignJWT({ u: "owner" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function validSession(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
