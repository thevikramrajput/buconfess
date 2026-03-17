import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caption } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const webhookUrl = process.env.MAKECOM_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ error: "MAKECOM_WEBHOOK_URL not set in environment variables" }, { status: 500 });

  const imageUrls: string[] = JSON.parse(confession.imageUrls || "[]");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://buconfess-production.up.railway.app";
  const absoluteImageUrls = imageUrls.map((u: string) =>
    u.startsWith("http") ? u : `${baseUrl}${u}`
  );

  const finalCaption = caption ||
    `BU Confession #${confession.number}

${absoluteImageUrls.length > 1 ? "(Swipe for more ➡️)" : ""}

#BUConfessions #BennettUniversity`;

  const payload = {
    confessionId: id,
    confessionNumber: confession.number,
    imageUrls: absoluteImageUrls,
    caption: finalCaption,
    totalParts: absoluteImageUrls.length,
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Make.com webhook failed: ${text}` }, { status: 500 });
  }

  // Mark as posted
  await prisma.confession.update({
    where: { id },
    data: { status: "posted" },
  });

  return NextResponse.json({ success: true, message: "Sent to Make.com for posting" });
}
