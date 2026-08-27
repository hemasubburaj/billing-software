import { Router } from "express";
import StorageItem from "../models/StorageItem.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/storage/:key
router.get("/:key", async (req, res) => {
  const item = await StorageItem.findOne({ userId: req.userId, key: req.params.key });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ key: item.key, value: item.value, shared: false });
});

// PUT /api/storage/:key   body: { value }
router.put("/:key", async (req, res) => {
  const { value } = req.body || {};
  if (typeof value !== "string") return res.status(400).json({ error: "value must be a string" });

  const item = await StorageItem.findOneAndUpdate(
    { userId: req.userId, key: req.params.key },
    { $set: { value } },
    { upsert: true, new: true }
  );
  res.json({ key: item.key, value: item.value, shared: false });
});

// DELETE /api/storage/:key
router.delete("/:key", async (req, res) => {
  const result = await StorageItem.findOneAndDelete({ userId: req.userId, key: req.params.key });
  res.json({ key: req.params.key, deleted: !!result, shared: false });
});

// GET /api/storage?prefix=xxx
router.get("/", async (req, res) => {
  const prefix = req.query.prefix || "";
  const items = await StorageItem.find({
    userId: req.userId,
    key: { $regex: "^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") },
  }).select("key");
  res.json({ keys: items.map((i) => i.key), prefix, shared: false });
});

export default router;
