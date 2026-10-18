export async function saveToDrive(token: string, name: string, blob: Blob) {
  const metadata = { name, mimeType: blob.type || "application/octet-stream" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
  );

  if (res.status === 401) throw new Error("reauth");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; webViewLink: string };
}