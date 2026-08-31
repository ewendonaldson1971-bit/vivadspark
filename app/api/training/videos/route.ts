import { NextResponse } from "next/server";
import { canDeleteTrainingVideos, getHoshinRequestUsername, trainingVideoDeleteAccess } from "../../../../lib/auth/hoshin-auth";

type CloudflareVideo = {
  uid?: string;
  allowedOrigins?: string[];
  deliveryReady?: boolean;
  created?: string;
  duration?: number;
  meta?: Record<string, unknown>;
  publicDetails?: { title?: string | null };
  playback?: { hls?: string; dash?: string };
  readyToStream?: boolean;
  requireSignedURLs?: boolean;
  status?: { state?: string; pctComplete?: string };
  thumbnail?: string;
};

type CloudflareResponse = {
  success: boolean;
  result?: CloudflareVideo[];
  errors?: Array<{ message?: string }>;
};

type CloudflareTokenResponse = {
  success: boolean;
  result?: { token?: string };
  errors?: Array<{ message?: string }>;
};

type DeleteVideoRequest = {
  uid?: unknown;
};

function getEnvironment() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "",
    apiToken:
      process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ??
      process.env.CLOUDFLARE_API_TOKEN?.trim() ??
      "",
    customerSubdomain:
      process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ??
      process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ??
      process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ??
      "",
  };
}

function normaliseStreamHost(value: string) {
  const cleaned = value
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!cleaned) return "";
  if (cleaned.endsWith(".cloudflarestream.com")) return cleaned;
  if (cleaned.startsWith("customer-")) return `${cleaned}.cloudflarestream.com`;
  return `customer-${cleaned}.cloudflarestream.com`;
}

function textMeta(meta: Record<string, unknown> | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function videoTitle(video: CloudflareVideo) {
  return textMeta(video.meta, "name") ||
    video.publicDetails?.title?.trim() ||
    `Training video ${video.uid?.slice(0, 6)}`;
}

function normalisedVideoTitle(video: CloudflareVideo) {
  return videoTitle(video).trim().toLowerCase();
}

function configuredOrigins() {
  const values = process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  return Array.from(new Set([
    "vivadspark.netlify.app",
    ...(values?.length
      ? values
      : [
          "keen-starlight-a13c9a.netlify.app",
          "hoshin-kanri-workspace.vivad-gpt-0611.chatgpt.site",
        ]),
  ]));
}

async function repairPlaybackOrigins(
  videos: CloudflareVideo[],
  accountId: string,
  apiToken: string,
) {
  const requiredOrigins = configuredOrigins();
  const videosToRepair = videos.filter((video) => video.uid &&
    requiredOrigins.some((origin) => !video.allowedOrigins?.includes(origin)));

  await Promise.all(videosToRepair.map(async (video) => {
    const allowedOrigins = Array.from(new Set([
      ...(video.allowedOrigins ?? []),
      ...requiredOrigins,
    ]));
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(video.uid as string)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: video.uid, allowedOrigins }),
      },
    );
    const payload = (await response.json()) as CloudflareResponse;
    if (!response.ok || !payload.success) {
      throw new Error(
        payload.errors?.[0]?.message ||
          `Cloudflare could not enable playback for ${video.uid}.`,
      );
    }
    video.allowedOrigins = allowedOrigins;
  }));

  return videosToRepair.length;
}

async function createSignedPlaybackToken(
  videoUid: string,
  accountId: string,
  apiToken: string,
) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(videoUid)}/token`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      }),
    },
  );
  const payload = (await response.json()) as CloudflareTokenResponse;
  const token = payload.result?.token?.trim() ?? "";
  if (!response.ok || !payload.success || !token) {
    throw new Error(
      payload.errors?.[0]?.message ||
        `Cloudflare could not create secure playback for ${videoUid}.`,
    );
  }
  return token;
}

function streamHostname(video: CloudflareVideo, configuredHost: string) {
  for (const value of [video.playback?.hls, video.thumbnail]) {
    if (!value) continue;
    try {
      return new URL(value).hostname;
    } catch {
      // Try the next provider URL before falling back to configuration.
    }
  }
  return normaliseStreamHost(configuredHost);
}

function streamAssetUrls(hostname: string, identifier: string) {
  if (!hostname || !identifier) return { playbackUrl: "", thumbnail: "" };
  const base = `https://${hostname}/${identifier}`;
  return {
    playbackUrl: `${base}/manifest/video.m3u8`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=1s&height=360`,
  };
}

async function probePlayback(playbackUrl: string, encodingComplete: boolean) {
  if (!encodingComplete || !playbackUrl) return { available: false, status: null };
  try {
    const response = await fetch(playbackUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Referer: "https://vivadspark.netlify.app/",
        Range: "bytes=0-1023",
      },
    });
    return { available: response.ok, status: response.status };
  } catch {
    return { available: false, status: null };
  }
}

function isEncodingComplete(video: CloudflareVideo) {
  const progress = Number(video.status?.pctComplete);
  if (Number.isFinite(progress)) {
    return video.status?.state === "ready" && progress >= 100;
  }
  return Boolean(video.readyToStream);
}

export async function GET(request: Request) {
  const env = getEnvironment();
  const username = await getHoshinRequestUsername(request);
  const missing = [
    !env.accountId && "CLOUDFLARE_ACCOUNT_ID",
    !env.apiToken && "CLOUDFLARE_STREAM_API_TOKEN",
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json(
      { connected: false, videos: [], missing },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/stream?limit=1000&type=vod`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const payload = (await response.json()) as CloudflareResponse;

    if (!response.ok || !payload.success) {
      const message = payload.errors?.[0]?.message || `Cloudflare Stream returned ${response.status}.`;
      throw new Error(message);
    }

    const sourceVideos = payload.result ?? [];
    const repairedPlaybackOrigins = await repairPlaybackOrigins(
      sourceVideos,
      env.accountId,
      env.apiToken,
    );

    const videos = await Promise.all(sourceVideos
      .filter((video) => video.uid)
      .map(async (video) => {
        const fallbackName = `Training video ${video.uid?.slice(0, 6)}`;
        const providerReady = isEncodingComplete(video);
        const requiresSignedUrls = Boolean(video.requireSignedURLs);
        const hostname = streamHostname(video, env.customerSubdomain);
        let playbackUrl = video.playback?.hls ?? "";
        let thumbnail = video.thumbnail ?? "";
        let securePlaybackError = "";

        if (providerReady && requiresSignedUrls && video.uid) {
          try {
            const token = await createSignedPlaybackToken(
              video.uid,
              env.accountId,
              env.apiToken,
            );
            ({ playbackUrl, thumbnail } = streamAssetUrls(hostname, token));
          } catch (error) {
            playbackUrl = "";
            thumbnail = "";
            securePlaybackError = error instanceof Error
              ? error.message
              : "Secure Cloudflare playback could not be created.";
          }
        } else if (providerReady && video.uid) {
          const fallbackAssets = streamAssetUrls(hostname, video.uid);
          playbackUrl ||= fallbackAssets.playbackUrl;
          thumbnail ||= fallbackAssets.thumbnail;
        }

        const deliveryProbe = await probePlayback(playbackUrl, providerReady);
        const deliveryReady = deliveryProbe.available;
        return {
          id: video.uid,
          videoUid: video.uid,
          title: videoTitle(video) || fallbackName,
          description:
            textMeta(video.meta, "description") ||
            "Cloudflare Stream training video.",
          category: textMeta(video.meta, "category") || "Training",
          level: textMeta(video.meta, "level") || "Vivad learning",
          owner: textMeta(video.meta, "owner") || "Vivad",
          durationSeconds: Math.max(0, Math.round(video.duration ?? 0)),
          thumbnail,
          playbackUrl,
          // Encoding completion alone is insufficient: a usable HLS URL must
          // exist and respond successfully before the UI calls a video ready.
          ready: Boolean(providerReady && playbackUrl && deliveryReady),
          providerReady,
          deliveryError: Boolean(providerReady && (!playbackUrl || !deliveryReady)),
          deliveryStatus: deliveryProbe.status,
          securePlaybackError: securePlaybackError || null,
          status: providerReady && (!playbackUrl || !deliveryReady)
            ? "delivery-error"
            : video.status?.state ?? "unknown",
          progress: video.status?.pctComplete ?? null,
          requiresSignedUrls,
          created: video.created ?? null,
          canDelete: canDeleteTrainingVideos(username),
        };
      }));
    videos.sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""));

    // A failed Stream upload can remain in Cloudflare after the original is
    // uploaded again. Prefer the healthy copy with the same title so the
    // training library never selects a known-broken duplicate.
    const preferredByTitle = new Map<string, (typeof videos)[number]>();
    for (const video of videos) {
      const key = video.title.trim().toLowerCase();
      const existing = preferredByTitle.get(key);
      if (!existing || (video.ready && !video.deliveryError && existing.deliveryError)) {
        preferredByTitle.set(key, video);
      }
    }
    const preferredVideos = Array.from(preferredByTitle.values());

    const derivedStreamHost = videos
      .flatMap((video) => [video.thumbnail, sourceVideos.find((item) => item.uid === video.videoUid)?.playback?.hls ?? ""])
      .filter(Boolean)
      .map((thumbnail) => {
        try {
          return new URL(thumbnail).hostname;
        } catch {
          return "";
        }
      })
      .find((hostname) => hostname.endsWith(".cloudflarestream.com"));

    return NextResponse.json({
      connected: true,
      streamHost: normaliseStreamHost(env.customerSubdomain) || derivedStreamHost || "",
      videos: preferredVideos,
      repairedPlaybackOrigins,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        videos: [],
        error: error instanceof Error ? error.message : "Cloudflare Stream could not be reached.",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const username = await getHoshinRequestUsername(request);
  const access = trainingVideoDeleteAccess(username);
  if (!access.allowed) {
    console.warn("Training video deletion denied", {
      reason: access.status === 401 ? "missing-or-expired-session" : "insufficient-permission",
    });
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "This delete request did not originate from Vivad SPARK." },
      { status: 403 },
    );
  }

  let body: DeleteVideoRequest;
  try {
    body = await request.json() as DeleteVideoRequest;
  } catch {
    return NextResponse.json({ error: "A video ID is required." }, { status: 400 });
  }

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!/^[a-f0-9]{32}$/i.test(uid)) {
    return NextResponse.json({ error: "The video ID is invalid." }, { status: 400 });
  }
  const env = getEnvironment();
  if (!env.accountId || !env.apiToken) {
    return NextResponse.json(
      { error: "Cloudflare Stream is not configured for this deployment." },
      { status: 503 },
    );
  }

  try {
    // The library intentionally groups duplicate uploads by title. Delete the
    // complete represented group so removing one card cannot reveal another
    // hidden copy with a different Cloudflare UID on the next refresh.
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/stream?limit=1000&type=vod`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const listPayload = (await listResponse.json().catch(() => ({}))) as CloudflareResponse;
    const listedVideos = listResponse.ok && listPayload.success ? listPayload.result ?? [] : [];
    const targetVideo = listedVideos.find((video) => video.uid === uid);
    const targetTitle = targetVideo ? normalisedVideoTitle(targetVideo) : "";
    const deletedUids = Array.from(new Set([
      uid,
      ...listedVideos
        .filter((video) => video.uid && targetTitle && normalisedVideoTitle(video) === targetTitle)
        .map((video) => video.uid as string),
    ]));

    await Promise.all(deletedUids.map(async (videoUid) => {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/stream/${encodeURIComponent(videoUid)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${env.apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        errors?: Array<{ message?: string }>;
      };
      // Cloudflare's Stream delete endpoint returns no response body on success.
      // Only an HTTP failure or an explicit `success: false` is an error.
      const alreadyAbsent = response.status === 404;
      if ((!response.ok && !alreadyAbsent) || (!alreadyAbsent && payload.success === false)) {
        throw new Error(
          payload.errors?.[0]?.message ||
            `Cloudflare Stream could not delete the video (${response.status}).`,
        );
      }
    }));

    return NextResponse.json(
      { deleted: true, uid, deletedUids, deletedBy: username },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "The training video could not be deleted.",
      },
      { status: 502 },
    );
  }
}
