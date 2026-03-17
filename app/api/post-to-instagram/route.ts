import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

const IG_API = 'https://graph.facebook.com/v20.0';

async function createMediaContainer(
  imageUrl: string,
  isCarouselItem: boolean,
  caption?: string
) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const userId = process.env.INSTAGRAM_USER_ID!;
  const body: any = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) body.is_carousel_item = true;
  else if (caption) body.caption = caption;

  const res = await fetch(`${IG_API}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Failed to create media container');
  return data.id as string;
}

async function publishCarousel(children: string[], caption: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const userId = process.env.INSTAGRAM_USER_ID!;
  const res = await fetch(`${IG_API}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Failed to create carousel');
  return data.id as string;
}

async function publishMedia(containerId: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const userId = process.env.INSTAGRAM_USER_ID!;
  const res = await fetch(`${IG_API}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || 'Failed to publish');
  return data;
}

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) {
    return NextResponse.json({ error: 'Instagram credentials not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID in Railway variables.' }, { status: 500 });
  }

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://buconfess-production.up.railway.app';
  const parts: string[] = confession.parts ? JSON.parse(confession.parts) : [confession.text];
  const handle = process.env.IG_HANDLE || '@bu.confess';
  const prefix = process.env.IG_CAPTION_PREFIX || '';
  const caption = `${prefix}Confession #${confession.number}\n\nDM or visit the link in bio to submit yours!\n\n${handle}`;

  try {

        // Send confession data to Make.com webhook for Instagram posting
            const webhookUrl = process.env.MAKE_WEBHOOK_URL;
                if (!webhookUrl) {
                        throw new Error('Make.com webhook URL not configured');
                            }

                                // Prepare image URLs for the webhook
                                    const imageUrls = parts.map((part: number) => `${appUrl}/api/image/${id}/${part}`);

                                        // Send data to Make.com webhook
                                            const webhookResponse = await fetch(webhookUrl, {
                                                    method: 'POST',
                                                          headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                          confessionId: id,
                                                                                  imageUrls,
                                                                                          caption,
                                                                                                }),
                                                                                                    });

    await prisma.confession.update({
      where: { id },
      data: { status: 'posted' },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Instagram API error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}