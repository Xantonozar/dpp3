import { Schema, Types } from "mongoose";

// Single-admin model: a record the admin saves is treated as verified.
// No Draft/Complete/Verified state machine.
export const recordMeta = {
  dataSource: { type: String, trim: true, maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
};

export const otherField = {
  code: { type: String, required: true, trim: true },
  other: { type: String, trim: true, maxlength: 200 },
};

export type ObjectIdLike = Types.ObjectId | string;
