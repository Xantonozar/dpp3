import mongoose, { Schema } from "mongoose";

const SizeOption = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const SizeSystemSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, trim: true },
    options: { type: [SizeOption], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SizeSystemSchema.index({ key: 1 }, { unique: true });

export const SizeSystem =
  mongoose.models.SizeSystem ||
  mongoose.model("SizeSystem", SizeSystemSchema);
