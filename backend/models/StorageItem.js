import mongoose from "mongoose";

// Generic per-user key/value store. Each key (e.g. "spark-billing-products")
// holds a JSON-stringified blob, mirroring the Claude Artifacts window.storage
// contract so the frontend code barely has to change.
const storageItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { timestamps: true }
);

storageItemSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("StorageItem", storageItemSchema);
