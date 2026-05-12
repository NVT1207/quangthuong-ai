import { redirect } from "next/navigation";

export default function ModelsRootPage() {
  redirect("/models/text-embedding");
}
