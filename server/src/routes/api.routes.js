import { Router } from "express";
import { z } from "zod";
import { initiateConversation, facilitateConversation } from "../facilitator/engine.js";

export const apiRouter = Router();

const initiateSchema = z.object({
  users_info: z.string().min(1, "users_info is required"),
});

const facilitateSchema = z.object({
  users_info: z.string().min(1, "users_info is required"),
  conversation: z.string().default(""),
});

// POST /api/initiate-conversation
apiRouter.post("/initiate-conversation", (req, res) => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = initiateConversation(parsed.data.users_info);
  return res.json({ data });
});

// POST /api/facilitate-conversation
apiRouter.post("/facilitate-conversation", (req, res) => {
  const parsed = facilitateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = facilitateConversation(parsed.data.users_info, parsed.data.conversation);
  return res.json({ data });
});
