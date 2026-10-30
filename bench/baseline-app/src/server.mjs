// Plain Hono with the same route the generated app serves; the bench measures tatara against this.
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/health", (c) => c.json({ status: "ok" }));
serve({ fetch: app.fetch, port: Number(process.env.PORT) });
