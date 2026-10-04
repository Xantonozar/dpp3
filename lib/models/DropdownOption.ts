import mongoose, { Schema } from "mongoose";

const DropdownOptionSchema = new Schema(
  {
    list: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    aliasOf: { type: String, trim: true },
    requiresSpecify: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DropdownOptionSchema.index({ list: 1, code: 1 }, { unique: true });
DropdownOptionSchema.index({ list: 1, active: 1, sortOrder: 1 });

export const DropdownOption =
  mongoose.models.DropdownOption ||
  mongoose.model("DropdownOption", DropdownOptionSchema);
