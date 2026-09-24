import { useTranslation } from "react-i18next";
import { Checkbox } from "../ui/Checkbox";
import { KnowledgeBaseDocuments } from "./KnowledgeBaseDocuments";

interface KnowledgeBaseToggleProps {
  enabled: boolean;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

/** Retell-only: adds the enable/disable checkbox (wires knowledge_base_enabled
 * into the Retell custom-function tool) around the shared document CRUD. */
export function KnowledgeBaseToggle({ enabled, disabled, onEnabledChange }: KnowledgeBaseToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={enabled}
        disabled={disabled}
        onChange={(e) => onEnabledChange(e.target.checked)}
        label={t("agentConfig.knowledgeBase.enableLabel")}
      />
      <KnowledgeBaseDocuments />
    </div>
  );
}
