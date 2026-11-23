import { Hono } from "hono";
import { z } from "zod";
import {
  authenticate,
  allowed,
  requirePermission,
  ApiFault,
  type AppEnv,
} from "./access";

export const admin = new Hono<AppEnv>();
admin.use("*", authenticate);
admin.get("/", (c) => {
  if (c.get("mfaRequired"))
    return c.json({
      userId: c.get("userId"),
      teamRole: null,
      permissions: [],
      mfaRequired: true,
    });
  if (!c.get("teamRole"))
    throw new ApiFault(403, "FORBIDDEN", "Team access is required.");
  return c.json({
    userId: c.get("userId"),
    teamRole: c.get("teamRole"),
    permissions: c.get("permissions"),
  });
});
