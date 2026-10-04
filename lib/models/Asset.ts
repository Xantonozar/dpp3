import mongoose, { Schema } from "mongoose";

const AssetSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    resourceType: {
      type: String,
      enum: ["image", "raw", "video"],
      default: "image",
    },
    deliveryType: {
      type: String,
      enum: ["upload", "authenticated"],
      default: "upload",
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    secureUrl: String,
    version: Number,
    purpose: {
      type: String,
      enum: ["color_image", "lab_report", "cert_evidence", "other"],
      default: "other",
    },
    ownerModel: String,
    ownerId: Schema.Types.ObjectId,
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AssetSchema.index({ publicId: 1 }, { unique: true });
AssetSchema.index({ ownerModel: 1, ownerId: 1 });

export const Asset =
  mongoose.models.Asset || mongoose.model("Asset", AssetSchema);
