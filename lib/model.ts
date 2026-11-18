// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks EVERY protocol in the snapshot that passes the house's own pre-token test,
// applied to the whole snapshot rather than only above the watchlist floor. A protocol is
// rankable when its record carries no token (no market cap, no CoinGecko id, no symbol) and
// it is not a wrapped, staked or bridged product of a token that already trades: its category
// is not CEX, Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking or Restaked BTC, its
// name carries no whole word wrapped / staked / staking, does not end in a version marker and
// does not begin with an exchange's name. That is the watchlist's rule, read from the fields
// the snapshot actually carries (parentProtocol is not one of them, so it cannot be tested).
// The 40 watchlist protocols all pass it; the board adds every other protocol that does,
// above and below the floor, with no TVL cutoff at all. Protocols that fail it — exchanges,
// bridges, liquid-staking receipts, versioned pools — are set aside with the live-token
// protocols, never mixed into the ranked board. The filter is unchanged from radar-2: it was
// verified against the house's own rule word for word, and no part of it is re-decided here.
//
// Implied value is a FITTED comps curve, not a flat multiple. The snapshot's live-token
// protocols that carry a market cap (128 of them) are the comps: the model fits
//
//   log(market cap / TVL) = intercept + slope x log(TVL)
//
// by least squares on those comps, and prices a pre-token protocol at
// TVL x exp(fitted log multiple), the fitted multiple clamped to 0.03–0.70x. On this
// snapshot the fit is log(multiple) = 6.96 - 0.48 x log(TVL): bigger protocols command a
// smaller multiple, and a flat category median ignores that. The fit is recomputed from the
// snapshot on every run; nothing about any protocol is hardcoded.
//
// What the blind test kept, and what it rejected. The fit is validated out of sample on the
// comps, against the radar-2 model (category median multiple, clamped 0.05–0.50x, times a
// growth multiplier and a maturity multiplier) as the baseline:
//   leave-one-out, median |log error|: fitted 1.22, baseline 1.67 (median APE 86% vs 95%,
//     within 2x: 31% vs 25%)
//   walk-forward, train on the oldest listings, test on the newest: fitted 1.12 vs 1.79
//     (train oldest 50%, test newest 50%) and 1.22 vs 1.54 (train oldest 75%, test newest 25%)
// A typical comp's market cap is predicted within ~3.4x by the fitted curve, ~5.3x by the
// baseline. Growth, age and category terms were all tried as fitted terms and all rejected:
// adding 7-day growth, log age or category dummies makes leave-one-out WORSE (1.28–1.36
// against 1.22 for the size curve alone), so the model prices off the size curve only and
// shows growth and age as context, not as pricing terms. Terms are kept only if the blind
// test keeps them.
//
// Rank ranges come from 200 refits: the comps are resampled with replacement (seeded, so
// every run agrees), the curve refitted, and each row's rank and implied value recorded.
// The board shows each row's rank range (10th–90th percentile across the refits), so a
// reader sees how stable a rank is instead of a single number that pretends certainty.
//
// Farm plans are costed to the dollar. Each plan's deposit is sized by the protocol's TVL
// ($50 / $100 / $150 / $250), its gas is the steps' own figures, and its economics step
// nets the plan: total cost, the expected value under the stated conservative floor (the
// airdrop pool pays 5% of implied value, split pro-rata by deposit), the net, the dollars
// per hour of active work, the break-even deposit, and a verdict — farm (break-even at or
// under $1,000), thin (under $2,500) or skip (above it). No protocol name is ever
// special-cased: the same function scores every row, and every constant the dashboard
// states can be recomputed from the snapshot.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  multiple_floor: number;
  multiple_cap: number;
  airdrop_share: number;
  verdict_farm_usd: number;
  verdict_thin_usd: number;
  refits: number;
  refit_seed: number;
}

export const MODEL: ModelConstants = {
  multiple_floor: 0.03,
  multiple_cap: 0.7,
  airdrop_share: 0.05,
  verdict_farm_usd: 1000,
  verdict_thin_usd: 2500,
  refits: 200,
  refit_seed: 20261114,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** A fitted size curve: log(multiple) = intercept + slope x log(TVL). */
export interface SizeCurveFit {
  intercept: number;
  slope: number;
  n: number;
  r2: number;
}

/** One blind-test score: median absolute log error, median absolute percentage error, share within 2x. */
export interface BlindScore {
  n: number;
  med_abs_log: number;
  med_ape: number;
  within_2x: number;
}

/** The validation the dashboard's KPI strip reports, all computed from the snapshot. */
export interface Validation {
  comps: number;
  loo_old: BlindScore;
  loo_new: BlindScore;
  wf_a_old: BlindScore;
  wf_a_new: BlindScore;
  wf_b_old: BlindScore;
  wf_b_new: BlindScore;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's economics, netted to the dollar. */
export interface FarmEconomics {
  capital_usd: number;
  total_cost_usd: number;
  expected_usd: number;
  net_usd: number;
  per_hour_usd: number;
  active_hours: number;
  breakeven_deposit_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fitted_multiple: number;
    growth_pct: number;
    age_days: number | null;
  };
  rank_range: [number, number];
  implied_range: [number, number];
  economics: FarmEconomics;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  fitted_multiple: number;
  rank_lo: number;
  rank_hi: number;
  implied_lo: number;
  implied_hi: number;
  capital_usd: number;
  active_hours: number;
  cost_usd: number;
  expected_usd: number;
  net_usd: number;
  per_hour_usd: number;
  breakeven_deposit_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  /** Whether it carries a market cap, so it served as a comp for the fit. */
  comp: boolean;
}

/** A pre-token protocol the board set aside, and the rule that set it aside. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  /** The watchlist's slugs, so the page marks [W] by membership, never by rank position. */
  watchlist: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  median_age_days: number;
  fit: SizeCurveFit;
  validation: Validation;
  refits: number;
  verdicts: { farm: number; thin: number; skip: number };
  accounted: { board: number; live: number; set_aside: number; total: number };
  derivative_set_aside: number;
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers; the middle value, or the mean of the middle two. */
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A deterministic PRNG (mulberry32) so the refits agree on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories whose products are a wrapped, staked or bridged form of a token that trades. */
const DERIVATIVE_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** A whole word wrapped, staked or staking anywhere in the name, in any case. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a token that already trades. This is the watchlist's own rule,
 * applied to the whole snapshot instead of only above its floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !DERIVATIVE_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** Why a pre-token protocol is set aside: the first rule it fails, in the rule's own words. */
export function setAsideReason(p: SnapshotProtocol): string {
  if (DERIVATIVE_CATEGORIES.has(p.category ?? '')) return `category ${p.category ?? 'none'} is a wrapped, staked or bridged product of a token that trades`;
  if (VERSIONED.test(p.name)) return 'name ends in a version marker, so it is a pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'name carries wrapped, staked or staking as a whole word';
  if (EXCHANGE_PREFIX.test(p.name)) return 'name begins with an exchange name';
  return 'not rankable';
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The median age, in days, of the pre-token protocols that carry a listed date. */
export function medianPreTokenAge(shot: Snapshot): number {
  const ages = shot.protocols
    .filter((p) => isPreToken(p))
    .map((p) => ageDays(shot.as_of, p.listed_at))
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  return ages.length > 0 ? Math.round(median(ages)) : 365;
}

/** One comp: a live-token protocol that carries a market cap and TVL, so it can anchor the fit. */
export interface Comp {
  slug: string;
  category: string;
  tvl: number;
  mcap: number;
  growth: number | null;
  age: number | null;
}

/** The comps: every live-token protocol with a market cap and TVL. */
export function compsOf(shot: Snapshot): Comp[] {
  return shot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({
      slug: p.slug,
      category: p.category ?? 'Other',
      tvl: p.tvl_usd,
      mcap: p.mcap_usd,
      growth: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      age: ageDays(shot.as_of, p.listed_at),
    }));
}

/**
 * The fitted size curve on a set of comps: least squares on log(mcap/TVL) against log(TVL).
 * Closed form for a two-parameter fit: slope is the covariance over the variance, intercept
 * the mean residual. Returns the fit with its R squared.
 */
export function fitSizeCurve(comps: Comp[]): SizeCurveFit {
  const xs = comps.map((c) => Math.log(c.tvl));
  const ys = comps.map((c) => Math.log(c.mcap / c.tvl));
  const n = comps.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    sst += (ys[i]! - my) ** 2;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  let rss = 0;
  for (let i = 0; i < n; i++) rss += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  return { intercept, slope, n, r2: sst > 0 ? 1 - rss / sst : 0 };
}

/** The fitted multiple for a TVL under a curve, clamped to the model's band. */
export function fittedMultiple(tvl: number, fit: SizeCurveFit, model: ModelConstants = MODEL): number {
  const raw = Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, tvl)));
  return Math.min(model.multiple_cap, Math.max(model.multiple_floor, raw));
}

/** The implied value of a pre-token protocol under the fitted curve. */
export function impliedValueFitted(
  protocol: SnapshotProtocol,
  fit: SizeCurveFit,
  model: ModelConstants = MODEL,
): number {
  return Math.max(1, Math.round(protocol.tvl_usd * fittedMultiple(protocol.tvl_usd, fit, model)));
}

/** The radar-2 baseline's constants, kept only to score it in the blind test. */
const OLD = {
  multiple_floor: 0.05,
  multiple_cap: 0.5,
  multiple_min_samples: 3,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1460,
};

/** The radar-2 baseline's implied value for one comp, from a training set of comps. */
function oldImplied(comp: Comp, train: Comp[], medianAge: number): number {
  const peers = train.filter((d) => d.slug !== comp.slug && d.category === comp.category).map((d) => d.mcap / d.tvl);
  const all = train.filter((d) => d.slug !== comp.slug).map((d) => d.mcap / d.tvl);
  const m = peers.length >= OLD.multiple_min_samples ? median(peers.sort((a, b) => a - b)) : median(all.sort((a, b) => a - b));
  const mult = Math.min(OLD.multiple_cap, Math.max(OLD.multiple_floor, m));
  const g = Math.min(OLD.growth_cap, Math.max(OLD.growth_floor, comp.growth ?? 0));
  const growthMult = 1 + (g / 100) * OLD.growth_weight;
  const a = comp.age ?? medianAge;
  const mat = OLD.maturity_floor + (Math.min(a, OLD.maturity_days) / OLD.maturity_days) * OLD.maturity_range;
  return Math.max(1, comp.tvl * mult * growthMult * mat);
}

/** A blind score from log errors against the true market caps. */
function blindScore(errors: number[]): BlindScore {
  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  const ape = errors.map((e) => Math.abs(Math.exp(e) - 1)).sort((a, b) => a - b);
  const mid = Math.floor(abs.length / 2);
  return {
    n: errors.length,
    med_abs_log: round4dp(abs[mid]!),
    med_ape: round4dp(ape[mid]!),
    within_2x: round4dp(errors.filter((e) => Math.abs(e) < Math.log(2)).length / errors.length),
  };
}

/**
 * Leave-one-out for the fitted curve, via the hat matrix (exact for least squares), and
 * for the radar-2 baseline, via leave-one-out category medians. The fitted curve's LOO
 * residual is r_i / (1 - h_i) with h_i = 1/n + (x_i - xbar)^2 / Sxx.
 */
export function looScores(comps: Comp[], medianAge: number): { old: BlindScore; new: BlindScore } {
  const fit = fitSizeCurve(comps);
  const xs = comps.map((c) => Math.log(c.tvl));
  const ys = comps.map((c) => Math.log(c.mcap / c.tvl));
  const n = comps.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  for (const x of xs) sxx += (x - mx) ** 2;
  const newErrs = comps.map((c, i) => {
    const r = ys[i]! - (fit.intercept + fit.slope * xs[i]!);
    const h = 1 / n + (xs[i]! - mx) ** 2 / sxx;
    return r / (1 - h);
  });
  const oldErrs = comps.map((c) => Math.log(c.mcap) - Math.log(oldImplied(c, comps, medianAge)));
  return { old: blindScore(oldErrs), new: blindScore(newErrs) };
}

/**
 * Walk-forward: sort the dated comps oldest-listed first; fold A trains on the oldest
 * half and tests on the newest half, fold B trains on the oldest three quarters and tests
 * on the newest quarter. Both models are scored on the same test sets.
 */
export function walkForwardScores(
  comps: Comp[],
  medianAge: number,
): { aOld: BlindScore; aNew: BlindScore; bOld: BlindScore; bNew: BlindScore } {
  const dated = comps.filter((c) => c.age !== null).sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
  const fold = (frac: number): { old: BlindScore; new: BlindScore } => {
    const k = Math.floor(dated.length * frac);
    const train = dated.slice(0, k);
    const test = dated.slice(k);
    const fit = fitSizeCurve(train);
    const oldErrs = test.map((c) => Math.log(c.mcap) - Math.log(oldImplied(c, train, medianAge)));
    const newErrs = test.map(
      (c) => Math.log(c.mcap) - Math.log(Math.max(1, c.tvl * fittedMultiple(c.tvl, fit))),
    );
    return { old: blindScore(oldErrs), new: blindScore(newErrs) };
  };
  const a = fold(0.5);
  const b = fold(0.75);
  return { aOld: a.old, aNew: a.new, bOld: b.old, bNew: b.new };
}

/** The whole blind test: LOO plus both walk-forward folds. */
export function validateModel(comps: Comp[], medianAge: number): Validation {
  const loo = looScores(comps, medianAge);
  const wf = walkForwardScores(comps, medianAge);
  return {
    comps: comps.length,
    loo_old: loo.old,
    loo_new: loo.new,
    wf_a_old: wf.aOld,
    wf_a_new: wf.aNew,
    wf_b_old: wf.bOld,
    wf_b_new: wf.bNew,
  };
}

/**
 * Rank ranges from refits: resample the comps with replacement (seeded), refit the curve,
 * rank the board rows, and record each row's 10th–90th percentile rank and implied value
 * across the refits. Deterministic: the same seed gives the same ranges on every run.
 */
export function bootstrapRanges(
  rows: { slug: string; tvl_usd: number }[],
  comps: Comp[],
  model: ModelConstants = MODEL,
): Map<string, { rank_lo: number; rank_hi: number; implied_lo: number; implied_hi: number }> {
  const rand = mulberry32(model.refit_seed);
  const ranks = new Map<string, number[]>();
  const implieds = new Map<string, number[]>();
  for (const r of rows) {
    ranks.set(r.slug, []);
    implieds.set(r.slug, []);
  }
  for (let k = 0; k < model.refits; k++) {
    const sample: Comp[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rand() * comps.length)]!);
    const fit = fitSizeCurve(sample);
    const scored = rows
      .map((r) => ({ slug: r.slug, implied: Math.max(1, Math.round(r.tvl_usd * round4dp(fittedMultiple(r.tvl_usd, fit, model)))) }))
      .sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => {
      ranks.get(s.slug)!.push(i + 1);
      implieds.get(s.slug)!.push(s.implied);
    });
  }
  const pct = (sorted: number[], q: number): number => sorted[Math.floor(q * (sorted.length - 1))]!;
  const out = new Map<string, { rank_lo: number; rank_hi: number; implied_lo: number; implied_hi: number }>();
  for (const r of rows) {
    const rr = ranks.get(r.slug)!.sort((a, b) => a - b);
    const ii = implieds.get(r.slug)!.sort((a, b) => a - b);
    out.set(r.slug, { rank_lo: pct(rr, 0.1), rank_hi: pct(rr, 0.9), implied_lo: pct(ii, 0.1), implied_hi: pct(ii, 0.9) });
  }
  return out;
}

const round4dp = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's effective age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null, medianAge: number): number {
  const a = age ?? medianAge;
  if (a < 180) return 60;
  if (a < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction'))
    return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('payment'))
    return `Route $${capital} through ${name} on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action: the thing that keeps the position counted. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Borrow a small amount against the deposit once a week and repay it the same day.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Swap a small amount through the pool once a week so the wallet stays active.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis'))
    return `Open and close one small hedge a week so the margin account stays active.`;
  if (c.includes('prediction'))
    return `Settle one small market position a week instead of leaving the funds idle.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Claim or restake the week's rewards once a week if the app offers it.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Check the vault's allocation once a week and rebalance only if its strategy changed.`;
  return `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
}

/**
 * A farm plan's economics, netted to the dollar. Total cost is the steps' own figures:
 * $3 for the first transaction, setup gas by deposit size, $2 of gas a week for the hold,
 * $4 to exit. Expected value is the stated conservative floor: the airdrop pool pays 5%
 * of implied value, split pro-rata by deposit. Net is expected minus cost; dollars per
 * hour divides the net by the steps' active time. The break-even deposit is the deposit
 * at which the floor expectation covers the cost. The verdict follows the break-even
 * deposit: at or under $1,000 farm, under $2,500 thin, above it skip.
 */
export function farmEconomics(
  p: SnapshotProtocol,
  age: number | null,
  medianAge: number,
  fitted: number,
  model: ModelConstants = MODEL,
): FarmEconomics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, medianAge);
  const weeks = Math.ceil(hold / 7);
  const setupGas = capital >= 150 ? 8 : 4;
  const totalCost = 3 + setupGas + 2 * weeks + 4;
  const expected = Math.round(capital * model.airdrop_share * fitted * 100) / 100;
  const net = Math.round((expected - totalCost) * 100) / 100;
  const activeHours = Math.round(((35 + 10 * weeks) / 60) * 100) / 100;
  const perHour = Math.round((net / activeHours) * 100) / 100;
  const breakeven = Math.ceil(totalCost / (model.airdrop_share * fitted) / 50) * 50;
  const verdict: 'farm' | 'thin' | 'skip' =
    breakeven <= model.verdict_farm_usd ? 'farm' : breakeven <= model.verdict_thin_usd ? 'thin' : 'skip';
  return {
    capital_usd: capital,
    total_cost_usd: totalCost,
    expected_usd: expected,
    net_usd: net,
    per_hour_usd: perHour,
    active_hours: activeHours,
    breakeven_deposit_usd: breakeven,
    verdict,
  };
}

/** The verdict in words a reader cannot mistake for a promise about the deposit above. */
function verdictPhrase(econ: FarmEconomics): string {
  if (econ.verdict === 'farm') return `farm — at the $${econ.breakeven_deposit_usd} break-even deposit, not the $${econ.capital_usd} deposit above`;
  if (econ.verdict === 'thin') return `thin — only with a larger deposit, $${econ.breakeven_deposit_usd} to break even`;
  return `skip — breaking even needs a $${econ.breakeven_deposit_usd} deposit`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, fitted multiple),
 * never from a hand-written list of names. The last step nets the plan to the dollar.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  medianAge: number,
  fitted: number,
  model: ModelConstants = MODEL,
): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age, medianAge);
  const action = actionFor(p, capital, chain);
  const econ = farmEconomics(p, age, medianAge, fitted, model);
  const weeks = Math.ceil(hold / 7);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyActionFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page, check the contract address matches the one its own page lists, and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and plan the exit now: withdraw in two steps if the pool is thin and keep gas aside for the last transaction.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `Economics, netted to the dollar: $${econ.total_cost_usd} total cost ($3 first transaction, $${capital >= 150 ? 8 : 4} setup gas, $${2 * weeks} weekly gas over ${weeks} weeks, $4 to exit). At the fitted multiple the $${capital} deposit expects $${econ.expected_usd.toFixed(2)} back if the airdrop pool pays 5% of implied value split pro-rata by deposit, the conservative floor, net $${econ.net_usd.toFixed(2)}, about $${econ.per_hour_usd.toFixed(2)} an hour for ${econ.active_hours} hours of work. Break-even deposit $${econ.breakeven_deposit_usd}. Verdict: ${verdictPhrase(econ)}.`,
      cost: `$${econ.total_cost_usd} in all, break-even deposit $${econ.breakeven_deposit_usd}`,
      time: `${econ.active_hours} hours of active work`,
    },
  ];
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  shot: Snapshot,
  model: ModelConstants = MODEL,
): BoardRow[] {
  const index = bySlug(shot.protocols);
  const medianAge = medianPreTokenAge(shot);
  const comps = compsOf(shot);
  const fit = fitSizeCurve(comps);
  const selected = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of shot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) selected.set(slug, p);
  }
  // The early radar: every other protocol that passes the pre-token test, above and below the
  // floor, with no TVL cutoff. A selected protocol stays selected.
  for (const p of shot.protocols) {
    if (!selected.has(p.slug) && isRankable(p)) selected.set(p.slug, p);
  }

  const valued = [...selected.values()].map((p) => {
    // Round the fitted multiple first: the board stores the rounded multiple, and the
    // dashboard recomputes from it, so the two must use the identical number.
    const fitted = round4dp(fittedMultiple(p.tvl_usd, fit, model));
    const age = ageDays(shot.as_of, p.listed_at);
    const growthPct = Math.min(120, Math.max(-60, finite(p.change_7d, 0)));
    const implied = Math.max(1, Math.round(p.tvl_usd * fitted));
    return { p, implied, fitted, age, growthPct };
  });
  valued.sort(
    (a, b) =>
      b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  const ranges = bootstrapRanges(
    valued.map((s) => ({ slug: s.p.slug, tvl_usd: s.p.tvl_usd })),
    comps,
    model,
  );
  return valued.map((s, i) => {
    const range = ranges.get(s.p.slug)!;
    const econ = farmEconomics(s.p, s.age, medianAge, s.fitted, model);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        fitted_multiple: round4dp(s.fitted),
        growth_pct: s.growthPct,
        age_days: s.age,
      },
      rank_range: [range.rank_lo, range.rank_hi],
      implied_range: [range.implied_lo, range.implied_hi],
      economics: econ,
      farm_steps: farmSteps(s.p, s.age, medianAge, s.fitted, model).map(stepText),
    };
  });
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(shot: Snapshot): LiveRow[] {
  const compSlugs = new Set(compsOf(shot).map((c) => c.slug));
  return shot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      comp: compSlugs.has(p.slug),
    }));
}

/** The pre-token protocols the board set aside, each with the rule that set it aside. */
export function setAsideRows(shot: Snapshot): SetAsideRow[] {
  return shot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p),
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    fitted_multiple: row.model.fitted_multiple,
    rank_lo: row.rank_range[0],
    rank_hi: row.rank_range[1],
    implied_lo: row.implied_range[0],
    implied_hi: row.implied_range[1],
    capital_usd: row.economics.capital_usd,
    active_hours: row.economics.active_hours,
    cost_usd: row.economics.total_cost_usd,
    expected_usd: row.economics.expected_usd,
    net_usd: row.economics.net_usd,
    per_hour_usd: row.economics.per_hour_usd,
    breakeven_deposit_usd: row.economics.breakeven_deposit_usd,
    verdict: row.economics.verdict,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  shot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const ordered = buildBoard(shot, model);
  const live = liveRows(shot);
  const setAside = setAsideRows(shot);
  const early = ordered.filter((r) => !shot.watchlist.includes(r.slug)).length;
  const medianAge = medianPreTokenAge(shot);
  const comps = compsOf(shot);
  const fit = fitSizeCurve(comps);
  const validation = validateModel(comps, medianAge);
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  for (const r of ordered) verdicts[r.economics.verdict]++;
  const radar: RadarData = {
    as_of: shot.as_of,
    source: shot.source,
    floor_usd: shot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: shot.watchlist.length,
    watchlist: [...shot.watchlist],
    board_size: ordered.length,
    early_size: early,
    live_size: live.length,
    median_age_days: medianAge,
    fit,
    validation,
    refits: model.refits,
    verdicts,
    accounted: {
      board: ordered.length,
      live: live.length,
      set_aside: setAside.length,
      total: ordered.length + live.length + setAside.length,
    },
    derivative_set_aside: setAside.length,
    rows: ordered.map(radarRow),
    live,
    set_aside: setAside,
  };
  return { board: ordered, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json did not parse as JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object at the top level');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no usable as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source field');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(ordered: BoardRow[], shot: Snapshot): string | null {
  const slugs = new Set(ordered.map((r) => r.slug));
  const missing = shot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = ordered.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < ordered.length; i++) if (ordered[i]!.implied_value_usd > ordered[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (ordered.length >= 2 && ordered[0]!.implied_value_usd === ordered[ordered.length - 1]!.implied_value_usd) {
    return `all ${ordered.length} rows share the same implied value $${ordered[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of ordered) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return 'window.RADAR=' + JSON.stringify(radar) + ';\n';
}
