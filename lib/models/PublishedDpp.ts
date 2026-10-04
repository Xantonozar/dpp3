import mongoose, { Schema } from "mongoose";

// What the QR page reads: ONLY approved public fields, versioned per publish.
const PublishedDppSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // public URL code /p/<shortCode>: random, non-guessable, never productId
    shortCode: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    version: { type: Number, default: 1 },
    snapshot: Schema.Types.Mixed,
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
// One live doc per code; history versions share the code while inactive.
PublishedDppSchema.index({ shortCode: 1 }, { name: "shortCode_live_unique", unique: true, partialFilterExpression: { active: true } });
// Hot-path public lookup runs without the active filter (410 needs inactive docs).
PublishedDppSchema.index({ shortCode: 1 }, { name: "shortCode_lookup" });
PublishedDppSchema.index({ slug: 1 }, { unique: true, sparse: true });
PublishedDppSchema.index({ productId: 1, version: -1 });

// Anonymous scan counts only: productId + timestamp (+ coarse country).
// No personal data, no fingerprints.
const ScanLogSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    shortCode: { type: String, trim: true },
    country: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
ScanLogSchema.index({ productId: 1, createdAt: -1 });

export const PublishedDpp =
  mongoose.models.PublishedDpp || mongoose.model("PublishedDpp", PublishedDppSchema);
export const ScanLog =
  mongoose.models.ScanLog || mongoose.model("ScanLog", ScanLogSchema);
