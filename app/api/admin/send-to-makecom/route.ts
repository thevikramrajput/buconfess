import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest();
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

  const webhookPayload = {
    confessionId: id,
    caption: caption || `Confession #${confession.number}`,
    imageUrls: absoluteImageUrls,
  };

  const webhookRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  if (!webhookRes.ok) {
    return NextResponse.json({ error: "Webhook call failed", status: webhookRes.status }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
