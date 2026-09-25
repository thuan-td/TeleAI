import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createKnowledgeBaseDocument,
  deleteKnowledgeBaseDocument,
  fetchKnowledgeBaseDocuments,
  uploadKnowledgeBaseFiles,
  type KnowledgeBaseDocument,
  type UploadResult,
} from "../../api/kb";
import { Textarea } from "../ui/Textarea";
import { TextInput } from "../ui/TextInput";

const UPLOAD_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png";

/** Shared Knowledge Base document CRUD — reused by both the Retell and
 * OpenAI Realtime config tabs (AgentConfigPage.tsx, OpenAIRealtimeConfig.tsx)
 * since both providers query the same kb_documents table. No enable/disable
 * toggle here — that's Retell-specific (see KnowledgeBaseToggle). */
export function KnowledgeBaseDocuments() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchKnowledgeBaseDocuments()
      .then(setDocuments)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const doc = await createKnowledgeBaseDocument({ title: title.trim(), content: content.trim() });
      setDocuments((prev) => [doc, ...prev]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    setError(null);
    setUploadResults([]);
    try {
      const results = await uploadKnowledgeBaseFiles(Array.from(fileList));
      setUploadResults(results);
      const newDocs = results.filter((r) => r.document).map((r) => r.document as KnowledgeBaseDocument);
      setDocuments((prev) => [...newDocs, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteKnowledgeBaseDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-base font-semibold text-fg">{t("agentConfig.knowledgeBase.title")}</h2>
      <p className="text-sm text-fg-subtle">{t("agentConfig.knowledgeBase.description")}</p>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <ul className="flex flex-col gap-1 rounded-md border border-border p-1.5">
        {documents.length === 0 && (
          <li className="px-3 py-2 text-sm text-fg-subtle">{t("agentConfig.knowledgeBase.empty")}</li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2">
            <div className="flex-1 rounded-md px-3 py-2 text-sm text-fg-muted">
              <span className="font-medium text-fg">{doc.title}</span>
              <span className="ml-2 text-xs text-fg-subtle">{doc.content.slice(0, 60)}</span>
            </div>
            <button
              type="button"
              disabled={deletingId === doc.id}
              onClick={() => handleDelete(doc.id)}
              title={t("agentConfig.knowledgeBase.deleteTitle")}
              className="rounded-md border border-border px-2 py-2 text-sm text-fg-muted hover:bg-surface-sunken disabled:cursor-not-allowed"
            >
              {deletingId === doc.id ? "…" : "✕"}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("agentConfig.knowledgeBase.namePlaceholder")}
          maxLength={200}
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("agentConfig.knowledgeBase.textPlaceholder")}
          rows={4}
        />
        <button
          type="button"
          disabled={isCreating || !title.trim() || !content.trim()}
          onClick={handleCreate}
          className="self-start rounded-md bg-fg px-3 py-2 text-sm font-medium text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? t("agentConfig.knowledgeBase.creating") : t("agentConfig.knowledgeBase.createButton")}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <label className="text-sm font-medium text-fg-muted">
          {t("agentConfig.knowledgeBase.uploadLabel")}
        </label>
        <p className="text-xs text-fg-subtle">{t("agentConfig.knowledgeBase.uploadNote")}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          disabled={isUploading}
          onChange={(e) => handleFileUpload(e.target.files)}
          className="text-sm text-fg-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg-muted hover:file:bg-surface-sunken disabled:cursor-not-allowed"
        />
        {isUploading && <p className="text-sm text-fg-subtle">{t("agentConfig.knowledgeBase.uploading")}</p>}
        {uploadResults.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {uploadResults.map((r) => (
              <li key={r.filename} className={r.success ? "text-success-fg" : "text-danger-fg"}>
                {r.success ? "✓" : "✕"} {r.filename}
                {r.error ? `: ${r.error}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
