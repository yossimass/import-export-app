import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerFileRoutes } from "./files";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Express app with API routes only. Shared by the long-running Node server
// (server/_core/index.ts) and the Netlify Function (netlify/functions/api.ts).
export function createApp() {
  const app = express();
  app.set("trust proxy", true);

  // When invoked as a Netlify Function the path may arrive prefixed with the
  // function route; normalize it so routes below match in both environments.
  app.use((req, _res, next) => {
    const prefix = "/.netlify/functions/api";
    if (req.url.startsWith(prefix)) {
      req.url = "/api" + req.url.slice(prefix.length);
    }
    next();
  });

  // Netlify caps synchronous function payloads at 6MB, so larger limits are moot
  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ limit: "6mb", extended: true }));

  // Authenticated file downloads under /api/files/*
  registerFileRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
