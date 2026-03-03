import express from "express";
const router = express.Router();

router.get("/health", async (req, res) => {
  res.json({ status: "ok" });
});

router.get("/logs", async (req, res) => {
  // return recent logs
});

export default router;
