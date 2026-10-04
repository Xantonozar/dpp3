import mongoose, { Schema } from "mongoose";

const VariantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    colorId: { type: Schema.Types.ObjectId, required: true },
    sizeKey: { type: String, required: true, trim: true },
    // STRING: trim only, keeps leading zeros. Never generated.
    gtin: { type: String, trim: true },
    gtinStatus: {
      type: String,
      enum: ["Draft", "GTIN Pending", "Valid", "Invalid", "Archived"],
      default: "GTIN Pending",
    },
    active: { type: Boolean, default: true },
    archivedAt: Date,
    archivedGtin: { type: String, trim: true },
  },
  { timestamps: true }
);

// one ACTIVE variant per product+color+size
VariantSchema.index(
  { productId: 1, colorId: 1, sizeKey: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
// no duplicate non-empty GTIN among active variants of a product
VariantSchema.index(
  { productId: 1, gtin: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true, gtin: { $type: "string", $gt: "" } },
  }
);
VariantSchema.index({ productId: 1, active: 1 });

export const Variant =
  mongoose.models.Variant || mongoose.model("Variant", VariantSchema);
