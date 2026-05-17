import { ModelsBrowser } from "../models-browser";
import { loadModelsByCategory } from "../_helpers";

export const dynamic = "force-dynamic";

export default async function TextEmbeddingPage() {
  const { models, providers, userTier } = await loadModelsByCategory(["text", "embedding"]);
  return (
    <ModelsBrowser
      models={models}
      providers={providers}
      userTier={userTier}
      title="Text & Embedding Models"
      subtitle={`${models.length} model chat + embedding. Giá tính theo VND / 1M tokens.`}
    />
  );
}
