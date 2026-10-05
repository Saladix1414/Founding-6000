export type FxRateSnapshot = {
  source: string;

  baseCurrency: "USD";
  quoteCurrency: "ARS";

  rateArsPerUsd: string;

  observedAt: string;

  metadata: Record<
    string,
    string | number | boolean | null
  >;
};

export interface FxProvider {
  getUsdArsRate():
    Promise<FxRateSnapshot>;
}
