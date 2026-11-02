import type { Express, Request, Response } from "express";
import { storageRead } from "../storage";
import { authenticateRequest } from "./auth";

// Serves files from Netlify Blobs. Keys are "<userId>/...", so a user may only
// read keys under their own id (admins may read any).
export function registerFileRoutes(app: Express) {
  app.get("/api/files/*", async (req: Request, res: Response) => {
    let user;
    try {
      user = await authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const key = decodeURIComponent((req.params as Record<string, string>)[0] || "");
    if (key.includes("..") || (user.role !== "admin" && !key.startsWith(`${user.id}/`))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const file = await storageRead(key);
      if (!file) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.end(Buffer.from(file.data));
    } catch (error) {
      console.error("[Files] Read failed", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  });
}
