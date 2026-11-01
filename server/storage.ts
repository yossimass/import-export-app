// File storage.
// - On Netlify (or anywhere Netlify Blobs credentials are present) files go to
//   a Netlify Blobs store and are served through the authenticated
//   /api/files/* route.
// - If BUILT_IN_FORGE_API_URL/KEY are set (legacy Manus hosting), the Manus
//   storage proxy is used instead.

import { getStore } from "@netlify/blobs";
import { ENV } from './_core/env';

const BLOB_STORE = "uploads";

function useForge() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey && !process.env.NETLIFY);
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function fileUrlForKey(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (!useForge()) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    // Copy into a standalone ArrayBuffer (Buffers may be views into a shared pool)
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await getStore(BLOB_STORE).set(key, body, { metadata: { contentType } });
    return { key, url: fileUrlForKey(key) };
  }

  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const form = new FormData();
  form.append("file", new Blob([data as any], { type: contentType }), key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

/** Read a stored file's bytes (Netlify Blobs only). */
export async function storageRead(
  relKey: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const result = await getStore(BLOB_STORE).getWithMetadata(normalizeKey(relKey), { type: "arrayBuffer" });
  if (!result) return null;
  return {
    data: result.data,
    contentType: (result.metadata?.contentType as string) || "application/octet-stream",
  };
}

export async function storageDelete(relKey: string): Promise<void> {
  if (useForge()) return; // Manus proxy has no delete endpoint
  await getStore(BLOB_STORE).delete(normalizeKey(relKey));
}
