import mongoose, { Schema } from "mongoose";
import { recordMeta, otherField } from "./_shared";

const PackagingSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    packagingType: { type: otherField, default: undefined },
    packagingMaterials: { type: [otherField], default: [] },
    // null + "Not Available" is distinct from 0.
    recycledContentPercent: { type: Number, min: 0, max: 100, default: null },
    recycledContentStatus: {
      type: String,
      enum: ["Provided", "Not Available"],
      default: "Not Available",
    },
    recyclability: {
      type: String,
      enum: ["Recyclable", "Non-recyclable", "Conditionally Recyclable", "Reusable", "Not Available"],
    },
    disposalReuseInstructions: { type: String, trim: true, maxlength: 4000 },
    ...recordMeta,
  },
  { timestamps: true }
);

PackagingSchema.index({ productId: 1 }, { unique: true });

export const Packaging =
  mongoose.models.Packaging || mongoose.model("Packaging", PackagingSchema);
