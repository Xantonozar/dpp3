import mongoose, { Schema } from "mongoose";

// Stable facility entities reused by Traceability AND Certification records.
const FacilitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    country: { type: String, trim: true, maxlength: 120 },
    kind: {
      type: String,
      enum: ["garment", "fabric", "yarn", "other"],
    },
  },
  { timestamps: true }
);

FacilitySchema.index({ name: 1, location: 1 }, { unique: true });
FacilitySchema.index({ name: "text", location: "text" });

export const Facility =
  mongoose.models.Facility || mongoose.model("Facility", FacilitySchema);
