import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isOwner } from "@/lib/auth/session";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps a route handler with the owner check, JSON errors and input validation. */
export function ownerRoute<Ctx>(handler: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (!(await isOwner())) throw new ApiError(401, "Please sign in again.");
      const result = await handler(req, ctx);
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof z.ZodError) {
        const where = err.issues.map((i) => i.path.join(".") || "body").join(", ");
        console.warn(`Invalid request to ${new URL(req.url).pathname}: ${where}`, JSON.stringify(err.issues));
        return NextResponse.json({ error: `Invalid request (${where})`, issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Expected a JSON body");
  }
  return schema.parse(json);
}
