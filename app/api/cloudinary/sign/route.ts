import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { UPLOAD_POLICY, signUpload, type UploadPurpose } from "@/lib/cloudinary";

const Body = z.object({
  purpose: z.enum(["color_image", "lab_report", "cert_evidence"]),
  productId: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { purpose, productId } = parsed.data;
    if (!(purpose in UPLOAD_POLICY)) {
      return NextResponse.json({ error: "Unknown purpose" }, { status: 400 });
    }
    await dbConnect();
    return NextResponse.json(signUpload(parsed.data.purpose as UploadPurpose, productId));
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
