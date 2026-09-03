import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const localRoot = path.join(process.cwd(), ".local", "files");

function usesVercelBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireHostedStorage() {
  if (process.env.VERCEL && !usesVercelBlob()) {
    throw new Error("Vercel Blob is not connected. Add a private Blob store to this project.");
  }
}

function localPath(key: string) {
  const resolved = path.resolve(localRoot, key);
  if (!resolved.startsWith(`${localRoot}${path.sep}`)) throw new Error("Invalid document storage key.");
  return resolved;
}

export async function storeOriginal(key: string, file: File) {
  requireHostedStorage();
  if (usesVercelBlob()) {
    const blob = await put(key, file, { access: "private", addRandomSuffix: false, contentType: file.type || "application/octet-stream" });
    return blob.pathname;
  }

  const destination = localPath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
  return key;
}

export async function readOriginal(key: string) {
  requireHostedStorage();
  if (usesVercelBlob()) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType || "application/octet-stream" };
  }

  try {
    return { body: await readFile(localPath(key)), contentType: "application/octet-stream" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteOriginal(key: string) {
  requireHostedStorage();
  if (usesVercelBlob()) {
    await del(key);
    return;
  }

  try {
    await unlink(localPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
