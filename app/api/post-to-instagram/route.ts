import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

const IG_API = 'https://graph.facebook.com/v20.0';

async function graphPost(path: string, body: Record<string, unknown>, accessToken: string) {
  const res = await fetch(`${IG_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const errMsg = data.error
      ? `Graph API Error ${data.error.code}/${data.error.error_subcode}: ${data.error.message}`
      : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data;
}

async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  isCarouselItem: boolean,
  caption?: string
) {
  const body: Record<string, unknown> = { image_url: imageUrl };
  if (isCarouselItem) body.is_carousel_item = true;
  else if (caption) body.caption = caption;
  const data = await graphPost(`${igUserId}/media`, body, accessToken);
  return data.id as string;
}

async function publishCarousel(
  igUserId: string,
  accessToken: string,
  children: string[],
  caption: string
) {
  const data = await graphPost(
    `${igUserId}/media`,
    { media_type: 'CAROUSEL', children: children.join(','), caption },
    accessToken
  );
  return data.id as string;
}

async function publishMedia(igUserId: string, accessToken: string, containerId: string) {
  const data = await graphPost(
    `${igUserId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );
  return data;
}

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const igUserId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igHandle = process.env.IG_HANDLE || '@bu.confess';
  const captionPrefix = process.env.IG_CAPTION_PREFIX || '';

  if (!igUserId || !accessToken) {
    return NextResponse.json(
      { error: 'Instagram credentials not configured. Set INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN in Railway variables.' },
      { status: 500 }
    );
  }

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://buconfess-production.up.railway.app';
  const parts: string[] = confession.parts ? JSON.parse(confession.parts) : [confession.text];
  const caption = `${captionPrefix}Confession #${confession.number}\n\nDM or visit the link in bio to submit yours!\n\n${igHandle}`;

  try {
    let publishedMediaId: string;

    if (parts.length === 1) {
      // Single image
      const imageUrl = `${appUrl}/api/image/${id}/0`;
      const containerId = await createMediaContainer(igUserId, accessToken, imageUrl, false, caption);
      const published = await publishMedia(igUserId, accessToken, containerId);
      publishedMediaId = published.id;
    } else {
      // Carousel
      const imageUrls = parts.map((_: string, i: number) => `${appUrl}/api/image/${id}/${i}`);
      const childIds = await Promise.all(
        imageUrls.map((url: string) => createMediaContainer(igUserId, accessToken, url, true))
      );
      const carouselId = await publishCarousel(igUserId, accessToken, childIds, caption);
      const published = await publishMedia(igUserId, accessToken, carouselId);
      publishedMediaId = published.id;
    }

    await prisma.confession.update({
      where: { id },
      data: { status: 'posted' },
    });

    return NextResponse.json({
      success: true,
      publishedMediaId,
      igUserId,
      handle: igHandle,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Instagram posting error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
