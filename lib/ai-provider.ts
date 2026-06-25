import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";

export type ModelProvider = "gemini" | "claude" | "mistral";

export const PROVIDER_CONFIG = {
  gemini: {
    label: "Gemini 2.0 Flash",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    modelId: "gemini-2.0-flash",
  },
  claude: {
    label: "Claude Sonnet 4.6",
    envKey: "ANTHROPIC_API_KEY",
    modelId: "claude-sonnet-4-6",
  },
  mistral: {
    label: "Mistral Small",
    envKey: "MISTRAL_API_KEY",
    modelId: "mistral-small-latest",
  },
} as const satisfies Record<ModelProvider, { label: string; envKey: string; modelId: string }>;

export function getModel(provider: ModelProvider): LanguageModel {
  const config = PROVIDER_CONFIG[provider];

  if (!process.env[config.envKey]) {
    throw new Error(
      `${config.envKey} is not configured. Add it to your environment variables to use ${config.label}.`
    );
  }

  if (provider === "gemini") return google(config.modelId);
  if (provider === "claude") return anthropic(config.modelId);
  return mistral(config.modelId);
}
