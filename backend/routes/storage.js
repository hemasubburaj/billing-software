import { Router } from "express";
import StorageItem from "../models/StorageItem.js";
import requireAuth from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

// GET /api/storage/bulk?keys=key1,key2,key3

router.get("/bulk", async (req, res) => {
  try {
    const keysParam = String(req.query.keys || "");

    const keys = keysParam
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    if (!keys.length) {
      return res.json({ values: {} });
    }

    const items = await StorageItem.find({
      userId: req.userId,
      key: { $in: keys },
    }).select("key value");

    const values = {};

    for (const item of items) {
      values[item.key] = item.value;
    }

    res.json({ values });
  } catch (error) {
    console.error("Storage BULK GET error:", error);
    res.status(500).json({
      error: "Failed to get storage items",
    });
  }
});

// GET /api/storage/:key

router.get("/:key", async (req, res) => {
  try {
    const item = await StorageItem.findOne({
      userId: req.userId,
      key: req.params.key,
    });

    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({
      key: item.key,
      value: item.value,
      shared: false,
    });
  } catch (error) {
    console.error("Storage GET error:", error);
    res.status(500).json({ error: "Failed to get storage item" });
  }
});

// PUT /api/storage/:key
// body: { value }
router.put("/:key", async (req, res) => {
  try {
    const { value } = req.body || {};

    if (typeof value !== "string") {
      return res
        .status(400)
        .json({ error: "value must be a string" });
    }

    const item = await StorageItem.findOneAndUpdate(
      {
        userId: req.userId,
        key: req.params.key,
      },
      {
        $set: { value },
      },
      {
        upsert: true,
        new: true,
      }
    );

    res.json({
      key: item.key,
      value: item.value,
      shared: false,
    });
  } catch (error) {
    console.error("Storage PUT error:", error);
    res.status(500).json({ error: "Failed to save storage item" });
  }
});

// DELETE /api/storage/:key
router.delete("/:key", async (req, res) => {
  try {
    const result = await StorageItem.findOneAndDelete({
      userId: req.userId,
      key: req.params.key,
    });

    res.json({
      key: req.params.key,
      deleted: !!result,
      shared: false,
    });
  } catch (error) {
    console.error("Storage DELETE error:", error);
    res.status(500).json({ error: "Failed to delete storage item" });
  }
});

// GET /api/storage?prefix=xxx
router.get("/", async (req, res) => {
  try {
    const prefix = String(req.query.prefix || "");

    const escapedPrefix = prefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const items = await StorageItem.find({
      userId: req.userId,
      key: {
        $regex: "^" + escapedPrefix,
      },
    }).select("key");

    res.json({
      keys: items.map((item) => item.key),
      prefix,
      shared: false,
    });
  } catch (error) {
    console.error("Storage LIST error:", error);
    res.status(500).json({ error: "Failed to list storage items" });
  }
});

export default router;
