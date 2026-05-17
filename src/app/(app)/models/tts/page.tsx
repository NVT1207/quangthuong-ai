import { ModelsBrowser } from "../models-browser";
import { loadModelsByCategory } from "../_helpers";

export const dynamic = "force-dynamic";

export default async function TtsModelsPage() {
  const { models, providers, userTier } = await loadModelsByCategory(["tts"]);
  return (
    <ModelsBrowser
      models={models}
      providers={providers}
      userTier={userTier}
      title="TTS Models"
      subtitle={`${models.length} model text-to-speech. Giá tính theo VND / 1M ký tự.`}
      showOutput={false}
      showContext={false}
    />
  );
}
