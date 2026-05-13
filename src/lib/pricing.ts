export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function computeCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number,
  discountPercent: number = 0
) {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  const factor = 1 - discountPercent / 100;
  return (inputCost + outputCost) * factor;
}
