import { Router } from "express";
import { getSetting } from "../lib/settings.js";

const router = Router();

router.get("/preview", async (_req, res) => {
  res.json({ projects: [], activities: [], certifications: [], careers: [] });
});

router.get("/home-layout", async (_req, res, next) => {
  try {
    const raw = await getSetting("home_layout", "");
    let layout = null;
    if (raw) {
      try {
        layout = JSON.parse(raw);
      } catch {
        layout = null;
      }
    }
    res.json({ layout });
  } catch (err) {
    next(err);
  }
});

export default router;
