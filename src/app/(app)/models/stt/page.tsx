import { ModelsBrowser } from "../models-browser";
import { loadModelsByCategory } from "../_helpers";

export const dynamic = "force-dynamic";

export default async function SttModelsPage() {
  const { models, providers, userTier } = await loadModelsByCategory(["stt"]);
  return (
    <ModelsBrowser
      models={models}
      providers={providers}
      userTier={userTier}
      title="STT Models"
      subtitle={`${models.length} model speech-to-text (Whisper). Giá tính theo VND / phút audio.`}
      showOutput={false}
      showContext={false}
    />
  );
}
