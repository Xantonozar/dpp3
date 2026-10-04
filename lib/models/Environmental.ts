import mongoose, { Schema } from "mongoose";
import { recordMeta } from "./_shared";

const EnvironmentalSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    inputs: {
      garmentWeightKg: { type: Number, min: 0.000001 },
      cuttingUtilizationPct: { type: Number, min: 0.0001, max: 100 },
      knittingKwhPerKg: { type: Number, min: 0 },
      dyeingKwhPerKg: { type: Number, min: 0 },
      fabricFinishingKwhPerKg: { type: Number, min: 0 },
      cuttingKwhPerGarment: { type: Number, min: 0 },
      sewingKwhPerGarment: { type: Number, min: 0 },
      garmentFinishingKwhPerGarment: { type: Number, min: 0 },
      gridSharePct: { type: Number, min: 0, max: 100 },
      solarSharePct: { type: Number, min: 0, max: 100 },
    },
    // SNAPSHOT at calculation time — later factor edits never rewrite history.
    emissionFactors: {
      gridKey: String,
      gridValue: Number,
      solarKey: String,
      solarValue: Number,
      source: String,
      yearVersion: String,
    },
    results: {
      fabricRequiredKg: Number,
      kwhPerGarment: {
        knitting: Number,
        dyeing: Number,
        fabricFinishing: Number,
        cutting: Number,
        sewing: Number,
        garmentFinishing: Number,
      },
      totalEnergyKwh: Number,
      gridEnergyKwh: Number,
      solarEnergyKwh: Number,
      carbonKgCo2e: Number,
      calculatedAt: Date,
    },
    ...recordMeta,
  },
  { timestamps: true }
);

EnvironmentalSchema.index({ productId: 1 }, { unique: true });

export const Environmental =
  mongoose.models.Environmental ||
  mongoose.model("Environmental", EnvironmentalSchema);
