import mongoose, { Schema } from "mongoose";

// Edited by admin only. NEVER seeded — the admin enters each factor with a
// documented source and yearVersion before any carbon can be computed.
const EmissionFactorSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["grid", "solar"], required: true },
    kgCo2ePerKwh: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, trim: true, maxlength: 300 },
    yearVersion: { type: String, required: true, trim: true, maxlength: 60 },
    methodology: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmissionFactorSchema.index({ key: 1 }, { unique: true });
EmissionFactorSchema.index({ type: 1, active: 1 });

export const EmissionFactor =
  mongoose.models.EmissionFactor ||
  mongoose.model("EmissionFactor", EmissionFactorSchema);
