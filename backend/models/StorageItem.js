import mongoose from "mongoose";

const storageItemSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
    },

    value: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

storageItemSchema.index(
  { userId: 1, key: 1 },
  { unique: true }
);

const StorageItem =
  mongoose.models.StorageItem ||
  mongoose.model("StorageItem", storageItemSchema);

export default StorageItem;
