import { ModelsBrowser } from "../models-browser";
import { loadModelsByCategory } from "../_helpers";

export const dynamic = "force-dynamic";

export default async function ImageModelsPage() {
  const { models, providers, userTier } = await loadModelsByCategory(["image"]);
  return (
    <ModelsBrowser
      models={models}
      providers={providers}
      userTier={userTier}
      title="Image Models"
      subtitle={`${models.length} model tạo ảnh. Giá tính theo VND / 1 ảnh.`}
      showOutput={false}
      showContext={false}
    />
  );
}
