import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// Meta Model API (Muse Spark), configured the same way as Sijil.
export function museSparkModel(): LanguageModel {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const meta = createOpenAICompatible({
    name: "meta",
    baseURL: process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1",
    apiKey,
  });
  return meta.chatModel(process.env.MUSE_SPARK_MODEL ?? "muse-spark-1.3");
}
