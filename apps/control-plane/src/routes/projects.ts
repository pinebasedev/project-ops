import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { projects } from "../db/schema";
import type { Env } from "../env";
import { isUniqueConstraintError } from "../helpers/dbErrors";
import { mintToken } from "../helpers/tokens";

const registerSchema = z.object({ name: z.string().min(1) });

export const projectRoutes = new Hono<Env>().post(
  "/",
  zValidator("json", registerSchema),
  async (c) => {
    const { name } = c.req.valid("json");
    const { token, tokenHash } = await mintToken();
    const id = crypto.randomUUID();

    try {
      await c.get("db").insert(projects).values({ id, name, tokenHash });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return c.json({ error: "A project with that name already exists" }, 409);
      }
      throw error;
    }

    return c.json({ id, name, token }, 201);
  },
);
