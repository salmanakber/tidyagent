import { NextResponse } from "next/server";
import { getSession } from "@/lib/security/session";
import { uploadAvatarToCloudinary } from "@/lib/cloudinary";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or GIF image." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep the photo under 4 MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadAvatarToCloudinary({
      buffer,
      mime: file.type,
      folderSuffix: session.organizationId,
    });
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 502 },
    );
  }
}
