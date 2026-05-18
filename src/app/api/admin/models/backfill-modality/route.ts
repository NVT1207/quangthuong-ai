import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OPENAI_TTS_VOICES, WHISPER_LANGUAGES } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// One-click migration: infer modality + pricingData từ category cho model cũ.
// Idempotent — skip nếu pricingData đã ≠ null.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const models = await prisma.model.findMany();
  const details: { slug: string; from: string; to: string }[] = [];
  let updated = 0;
  let skipped = 0;

  for (const m of models) {
    if (m.pricingData !== null) {
      skipped++;
      continue;
    }
    let modality = m.modality || "TEXT";
    let pricingData: any | null = null;

    switch (m.category) {
      case "text":
        modality = "TEXT";
        pricingData = null;
        break;
      case "embedding":
        modality = "EMBEDDING";
        pricingData = null;
        break;
      case "image":
        modality = "IMAGE";
        pricingData = {
          matrix: [{ size: "1024x1024", quality: "auto", price: m.inputPrice || 0 }],
        };
        break;
      case "video":
        modality = "VIDEO";
        pricingData = {
          matrix: [{ resolution: "720p", duration: "8s", price: m.inputPrice || 0 }],
        };
        break;
      case "tts":
        modality = "AUDIO_TTS";
        pricingData = { charRate: m.inputPrice || 0, voices: OPENAI_TTS_VOICES };
        break;
      case "stt":
        modality = "AUDIO_STT";
        pricingData = { minuteRate: m.inputPrice || 0, languages: [...WHISPER_LANGUAGES] };
        break;
      default:
        modality = "TEXT";
        pricingData = null;
    }

    if (
      (modality === "TEXT" || modality === "EMBEDDING") &&
      m.modality === modality &&
      m.pricingData === null
    ) {
      skipped++;
      continue;
    }

    await prisma.model.update({
      where: { id: m.id },
      data: {
        modality,
        ...(pricingData !== null ? { pricingData } : {}),
      },
    });
    updated++;
    details.push({ slug: m.slug, from: `${m.category}/${m.modality}`, to: modality });
  }

  return NextResponse.json({
    ok: true,
    scanned: models.length,
    updated,
    skipped,
    details,
  });
}
