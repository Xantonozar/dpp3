import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog";

export async function writeAudit(input: {
  entity: string;
  entityId?: mongoose.Types.ObjectId | string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  changedBy?: mongoose.Types.ObjectId | string;
}) {
  await AuditLog.create({
    ...input,
    changedAt: new Date(),
  });
}
