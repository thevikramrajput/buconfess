import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

const GRAPH_API_VERSION = 'v20.0';
const DEFAULT_APP_URL = 'https://buconfess-production.up.railway.app';

type GraphResponse = {
  id?: string;
  permalink?: string;
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    fbtrace_id?: string;
  };
};

function normalizeHandle(handle: string) {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
}

function toAbsoluteUrl(baseUrl: string, value: string) {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function buildCaption(confessionNumber: number | null, handle: string) {
  const prefix = (process.env.IG_CAPTION_PREFIX || 'BU Confession').trim();
  return [
    `${prefix} #${confessionNumber ?? 'Draft'}`,
    'DM or visit the link in bio to submit yours!',
    normalizeHandle(handle),
  ].join('\n\n');
}

async function graphPost(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });

  const data = (await response.json()) as GraphResponse;
  if (!response.ok || data.error) {
    console.error('Instagram Graph API failure', {
      path,
      status: response.status,
      error: data.error ?? data,
      body,
    });
    throw new Error(
      data.error?.message || `Graph API request failed with status ${response.status}`
    );
  }

  return data;
}

async function graphGet(path: string, accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`,
    { method: 'GET' }
  );

  const data = (await response.json()) as GraphResponse;
  if (!response.ok || data.error) {
    console.error('Instagram Graph API failure', {
      path,
      status: response.status,
      error: data.error ?? data,
    });
    throw new Error(
      data.error?.message || `Graph API request failed with status ${response.status}`
    );
  }

  return data;
}

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const igUserId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!igUserId || !accessToken) {
    return NextResponse.json(
      { error: 'Instagram credentials not configured' },
      { status: 500 }
    );
  }

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (confession.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved confessions can be posted to Instagram' },
      { status: 400 }
    );
  }

  const baseUrl = getBaseUrl();
  const storedImageUrls: string[] = confession.imageUrls ? JSON.parse(confession.imageUrls) : [];
  const imageUrls =
    storedImageUrls.length > 0
      ? storedImageUrls.map((value) => toAbsoluteUrl(baseUrl, value))
      : [`${baseUrl}/api/image/${id}/0`];
  const caption = buildCaption(confession.number ?? null, process.env.IG_HANDLE || 'bu.confess');

  try {
    const creationIds: string[] = [];

    for (const imageUrl of imageUrls) {
      const container = await graphPost(
        `${igUserId}/media`,
        imageUrls.length > 1
          ? { image_url: imageUrl, is_carousel_item: true }
          : { image_url: imageUrl, caption },
        accessToken
      );

      if (!container.id) {
        throw new Error('Instagram media container was created without an id');
      }

      creationIds.push(container.id);
    }

    let publishTargetId = creationIds[0];
    if (creationIds.length > 1) {
      const carouselContainer = await graphPost(
        `${igUserId}/media`,
        {
          media_type: 'CAROUSEL',
          children: creationIds,
          caption,
        },
        accessToken
      );

      if (!carouselContainer.id) {
        throw new Error('Instagram carousel container was created without an id');
      }

      publishTargetId = carouselContainer.id;
    }

    const published = await graphPost(
      `${igUserId}/media_publish`,
      { creation_id: publishTargetId },
      accessToken
    );

    if (!published.id) {
      throw new Error('Instagram publish response did not include a media id');
    }

    let permalink: string | null = null;
    try {
      const mediaDetails = await graphGet(`${published.id}?fields=id,permalink`, accessToken);
      permalink = mediaDetails.permalink || null;
    } catch (error) {
      console.error('Failed to fetch Instagram permalink', {
        publishId: published.id,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    await prisma.confession.update({
      where: { id },
      data: {
        status: 'posted',
        igPostId: published.id,
        igPermalink: permalink,
      },
    });

    return NextResponse.json({
      success: true,
      igPostId: published.id,
      igPermalink: permalink,
      publishedChildrenCount: creationIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Instagram publish error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
