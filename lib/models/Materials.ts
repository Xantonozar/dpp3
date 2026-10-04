import mongoose, { Schema } from "mongoose";
import { recordMeta, otherField } from "./_shared";

const FiberRow = new Schema(
  {
    fiberCode: { type: String, required: true, trim: true },
    otherName: { type: String, trim: true, maxlength: 120 },
    percentage: { type: Number, required: true, min: 0.0001, max: 100 },
  },
  { _id: true }
);

const TrimRow = new Schema(
  {
    componentCode: { type: String, required: true, trim: true },
    otherName: { type: String, trim: true, maxlength: 120 },
    materialType: { type: String, trim: true, maxlength: 120 },
  },
  { _id: true }
);

const MaterialsSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    mainFabric: {
      fabricType: { type: otherField, default: undefined },
      fibers: { type: [FiberRow], default: [] },
      compositionTotal: Number,
      gsm: { type: Number, min: 0.0001 },
      construction: { type: String, trim: true, maxlength: 200 },
    },
    trims: { type: [TrimRow], default: [] },
    ...recordMeta,
  },
  { timestamps: true }
);

MaterialsSchema.index({ productId: 1 }, { unique: true });
MaterialsSchema.index({ "mainFabric.fibers.fiberCode": 1 });

export const Materials =
  mongoose.models.Materials || mongoose.model("Materials", MaterialsSchema);
