import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const UPLOAD_POLICY = {
  color_image: {
    type: "upload",
    resource_type: "image",
    formats: "jpg,jpeg,png,webp",
    maxBytes: 5_000_000,
  },
  lab_report: {
    type: "authenticated",
    resource_type: "image",
    formats: "pdf",
    maxBytes: 15_000_000,
  },
  cert_evidence: {
    type: "authenticated",
    resource_type: "image",
    formats: "pdf,jpg,jpeg,png",
    maxBytes: 15_000_000,
  },
} as const;

export type UploadPurpose = keyof typeof UPLOAD_POLICY;

export function signUpload(purpose: UploadPurpose, productId: string) {
  const p = UPLOAD_POLICY[purpose];
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `dpp/${process.env.APP_ENV ?? "dev"}/products/${productId}/${purpose}`;
  // Sign EXACTLY the params the browser sends (file/api_key/cloud_name/
  // resource_type/signature are excluded by Cloudinary). Anything else signed
  // but not sent — e.g. allowed_formats — breaks verification.
  const params = {
    timestamp,
    folder,
    type: p.type,
  };
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    ...params,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    resourceType: p.resource_type,
    formats: p.formats,
    maxBytes: p.maxBytes,
  };
}

export async function verifyAsset(publicId: string) {
  return cloudinary.api.resource(publicId);
}

export function privateUrl(publicId: string, expiresInSec = 600) {
  return cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    expires_at: Math.round(Date.now() / 1000) + expiresInSec,
  });
}
