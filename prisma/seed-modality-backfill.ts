// Idempotent backfill: infer modality + pricingData từ category cho model cũ.
// Chạy local: npx tsx prisma/seed-modality-backfill.ts
// Hoặc production: POST /api/admin/models/backfill-modality
//
// Logic:
//  - category = "text" | "embedding"  → modality = TEXT / EMBEDDING, pricingData = null
//  - category = "image"               → modality = IMAGE, pricingData.matrix = [{ 1024x1024, auto, inputPrice }]
//  - category = "video"               → modality = VIDEO, pricingData.matrix = [{ 720p, 8s, inputPrice }]
//  - category = "tts"                 → modality = AUDIO_TTS, pricingData = { charRate: inputPrice, voices: OPENAI_TTS_VOICES }
//  - category = "stt"                 → modality = AUDIO_STT, pricingData = { minuteRate: inputPrice, languages: WHISPER }
//  - SKIP nếu pricingData đã ≠ null (idempotent).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inline để script tsx chạy độc lập, không cần resolve TS path alias.
const OPENAI_TTS_VOICES = [
  { id: "alloy", name: "Alloy" },
  { id: "echo", name: "Echo" },
  { id: "fable", name: "Fable" },
  { id: "onyx", name: "Onyx" },
  { id: "nova", name: "Nova" },
  { id: "shimmer", name: "Shimmer" },
];

const WHISPER_LANGUAGES = [
  "af","ar","hy","az","be","bs","bg","ca","zh","hr","cs","da","nl","en","et","fi","fr","gl",
  "de","el","he","hi","hu","is","id","it","ja","kn","kk","ko","lv","lt","mk","ms","mr","mi",
  "ne","no","fa","pl","pt","ro","ru","sr","sk","sl","es","sw","sv","tl","ta","th","tr","uk",
  "ur","vi","cy","yi","yo","am","my","sn","gu","sd","su","tt","tg","te","tk","uz","ba",
  "br","ka","si","sa","sm","ha","ht","la","lb","jw","mg","ml","mn","oc","ps",
  "lo","mt","so","ss","tn","ts","nso","ng",
];

export async function runBackfill(): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
  details: { slug: string; from: string; to: string }[];
}> {
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
          matrix: [
            { size: "1024x1024", quality: "auto", price: m.inputPrice || 0 },
          ],
        };
        break;
      case "video":
        modality = "VIDEO";
        pricingData = {
          matrix: [
            { resolution: "720p", duration: "8s", price: m.inputPrice || 0 },
          ],
        };
        break;
      case "tts":
        modality = "AUDIO_TTS";
        pricingData = {
          charRate: m.inputPrice || 0,
          voices: OPENAI_TTS_VOICES,
        };
        break;
      case "stt":
        modality = "AUDIO_STT";
        pricingData = {
          minuteRate: m.inputPrice || 0,
          languages: [...WHISPER_LANGUAGES],
        };
        break;
      default:
        modality = "TEXT";
        pricingData = null;
    }

    // Nếu là TEXT/EMBEDDING + modality đã đúng → không cần update
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

  return { scanned: models.length, updated, skipped, details };
}

async function main() {
  const r = await runBackfill();
  console.log(`✅ Backfill done: scanned=${r.scanned} updated=${r.updated} skipped=${r.skipped}`);
  for (const d of r.details) {
    console.log(`  · ${d.slug}: ${d.from} → ${d.to}`);
  }
}

// Run when executed directly via tsx
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
