import mongoose, { Schema } from "mongoose";

const ColorImageSchema = new Schema(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset" },
    publicId: { type: String, trim: true },
    secureUrl: { type: String, trim: true },
    altText: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const ColorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    colorCode: { type: String, trim: true, maxlength: 40 },
    images: { type: [ColorImageSchema], default: [] },
    sortOrder: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { _id: true }
);

const ProductSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true, maxlength: 60 },
    styleNo: { type: String, trim: true, maxlength: 60 },
    name: { type: String, trim: true, maxlength: 200 },
    productType: { type: String, trim: true, maxlength: 120 },
    buyerBrand: { type: String, trim: true, maxlength: 120 },
    sizeSystemKey: { type: String, trim: true },
    colors: { type: [ColorSchema], default: [] },
    status: {
      type: String,
      enum: ["Draft", "Published", "Archived"],
      default: "Draft",
    },
    publishedSlug: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ProductSchema.index({ productId: 1 }, { unique: true });
ProductSchema.index({ publishedSlug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ status: 1, updatedAt: -1 });
// Default list view sorts unfiltered by recency — confirmed by explain test.
ProductSchema.index({ updatedAt: -1 });
ProductSchema.index({ name: "text", styleNo: "text", productId: "text" });

export const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);
