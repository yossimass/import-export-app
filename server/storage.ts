// File storage in a Netlify Blobs store (zero config on Netlify; use
// `netlify dev` locally). Files are served through the workspace-scoped
// /api/files/* route.

import { getStore } from "@netlify/blobs";

const BLOB_STORE = "uploads";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
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
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  // Copy into a standalone ArrayBuffer (Buffers may be views into a shared pool)
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await getStore(BLOB_STORE).set(key, body, { metadata: { contentType } });
  return { key, url: fileUrlForKey(key) };
}

/** Read a stored file's bytes. */
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
  await getStore(BLOB_STORE).delete(normalizeKey(relKey));
}
