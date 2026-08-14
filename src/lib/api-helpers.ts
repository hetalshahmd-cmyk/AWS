import { NextResponse } from "next/server";
import { requireSession, UnauthorizedError } from "./auth";

/**
 * Wraps an admin route handler: enforces the session, turns thrown errors into
 * JSON responses so each route can stay focused on its own work.
 */
export function adminRoute<T extends unknown[]>(
  handler: (request: Request, ...args: T) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: T): Promise<NextResponse> => {
    try {
      await requireSession();
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Sign in first" }, { status: 401 });
      }
      console.error("admin route failed", error);
      const message = error instanceof Error ? error.message : "Something went wrong";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
