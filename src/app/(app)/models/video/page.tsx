import { ModelsBrowser } from "../models-browser";
import { loadModelsByCategory } from "../_helpers";

export const dynamic = "force-dynamic";

export default async function VideoModelsPage() {
  const { models, providers, userTier } = await loadModelsByCategory(["video"]);
  return (
    <ModelsBrowser
      models={models}
      providers={providers}
      userTier={userTier}
      title="Video Models"
      subtitle={`${models.length} model sinh video. Giá tính theo VND / 1 giây.`}
      showOutput={false}
      showContext={false}
    />
  );
}
