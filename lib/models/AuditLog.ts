import mongoose, { Schema } from "mongoose";

const AuditLogSchema = new Schema(
  {
    entity: { type: String, required: true, trim: true },
    entityId: Schema.Types.ObjectId,
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    reason: String,
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

AuditLogSchema.index({ entity: 1, entityId: 1, changedAt: -1 });
AuditLogSchema.index({ changedBy: 1, changedAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
