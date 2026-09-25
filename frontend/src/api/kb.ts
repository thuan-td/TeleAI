import { apiFetch, parseErrorDetail } from "./client";

export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
}

export interface KnowledgeBaseDocumentCreate {
  title: string;
  content: string;
}

export interface KnowledgeBaseQueryResult {
  title: string;
  content: string;
}

export interface UploadResult {
  filename: string;
  success: boolean;
  document: KnowledgeBaseDocument | null;
  error: string | null;
}

export async function fetchKnowledgeBaseDocuments(): Promise<KnowledgeBaseDocument[]> {
  const response = await apiFetch("/kb/documents");
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to fetch documents: ${response.status}`));
  }
  return response.json();
}

export async function createKnowledgeBaseDocument(
  body: KnowledgeBaseDocumentCreate,
): Promise<KnowledgeBaseDocument> {
  const response = await apiFetch("/kb/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to create document: ${response.status}`));
  }
  return response.json();
}

export async function deleteKnowledgeBaseDocument(documentId: string): Promise<void> {
  const response = await apiFetch(`/kb/documents/${documentId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to delete document: ${response.status}`));
  }
}

export async function uploadKnowledgeBaseFiles(files: File[]): Promise<UploadResult[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const response = await apiFetch("/kb/documents/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to upload files: ${response.status}`));
  }
  const data = await response.json();
  return data.results;
}

export async function queryKnowledgeBase(query: string): Promise<KnowledgeBaseQueryResult[]> {
  const response = await apiFetch("/kb/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, `Failed to query knowledge base: ${response.status}`));
  }
  const data = await response.json();
  return data.results;
}
