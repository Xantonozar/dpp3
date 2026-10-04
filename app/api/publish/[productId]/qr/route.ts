import { NextResponse } from "next/server";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { dbConnect } from "@/lib/db";
import { requireAdmin, toHttpError } from "@/lib/auth";
import { PublishedDpp } from "@/lib/models/PublishedDpp";

type Ctx = { params: Promise<{ productId: string }> };

// Admin downloads the QR for print (SVG) and digital (PNG)
export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const format = new URL(req.url).searchParams.get("format") ?? "svg";
    await dbConnect();
    const live = (await PublishedDpp.findOne({ productId, active: true }).sort({ version: -1 }).lean()) as unknown as {
      shortCode: string;
    } | null;
    if (!live) {
      return NextResponse.json({ error: "Publish first to get a QR code." }, { status: 404 });
    }
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const url = `${base}/p/${live.shortCode}`;
    if (format === "png") {
      const buf = await QRCode.toBuffer(url, { width: 1024, errorCorrectionLevel: "M" });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="dpp-${live.shortCode}.png"`,
        },
      });
    }
    const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="dpp-${live.shortCode}.svg"`,
      },
    });
  } catch (e) {
    const { status, message } = toHttpError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
