import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

const IG_API = 'https://graph.facebook.com/v20.0';

async function createMediaContainer(imageUrl: string, isCarouselItem = false, caption = '') {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const params: any = { image_url: imageUrl, access_token: token };
  if (isCarouselItem) {
    params.is_carousel_item = true;
  } else {
    params.caption = caption;
  }
  const res = await fetch(IG_API + '/' + userId + '/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.id) throw new Error('Failed to create media container: ' + JSON.stringify(data));
  return data.id;
}

async function createCarouselContainer(childIds: string[], caption: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const res = await fetch(IG_API + '/' + userId + '/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error('Failed to create carousel: ' + JSON.stringify(data));
  return data.id;
}

async function publishMedia(creationId: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  const res = await fetch(IG_API + '/' + userId + '/media_publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (confession.status === 'posted') return NextResponse.json({ error: 'Already posted' }, { status: 400 });

  const imageUrls: string[] = JSON.parse(confession.imageUrls || '[]');
  if (!imageUrls.length) return NextResponse.json({ error: 'No images generated yet' }, { status: 400 });

  const caption = (process.env.IG_CAPTION_PREFIX || 'BU Confession') + ' #' + confession.number + '

' + (process.env.IG_HANDLE || '@bu.confess');

  try {
    let creationId: string;
    if (imageUrls.length === 1) {
      // Single image post
      creationId = await createMediaContainer(imageUrls[0], false, caption);
    } else {
      // Carousel post
      const childIds: string[] = [];
      for (const url of imageUrls) {
        const childId = await createMediaContainer(url, true);
        childIds.push(childId);
      }
      creationId = await createCarouselContainer(childIds, caption);
    }

    const publishResult = await publishMedia(creationId);
    if (!publishResult.id) throw new Error('Publish failed: ' + JSON.stringify(publishResult));

    await prisma.confession.update({
      where: { id },
      data: { status: 'posted', igPostId: publishResult.id },
    });

    return NextResponse.json({ success: true, igPostId: publishResult.id });
  } catch (e: any) {
    console.error('Instagram API error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
