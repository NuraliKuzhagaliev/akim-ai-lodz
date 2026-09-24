import { z } from 'zod';
export const indicatorIds = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'] as const;
export const categories = ['transport', 'ecology', 'social', 'safety', 'services'] as const;
export const districtIdSchema = z.enum(['esil', 'almaty', 'saryarka', 'baikonur', 'nura']);
export type DistrictId = z.infer<typeof districtIdSchema>;
export type Category = (typeof categories)[number];
export type IndicatorId = (typeof indicatorIds)[number];
export const indicatorsSchema = z.object(
  Object.fromEntries(indicatorIds.map((id) => [id, z.number().min(0).max(100)])) as Record<
    IndicatorId,
    z.ZodNumber
  >,
);
export const districtSchema = z.object({
  id: districtIdSchema,
  name: z.string(),
  populationShare: z.number().min(0).max(1),
  profile: z.string(),
  indicators: indicatorsSchema,
  score: z.number().finite(),
});
export type District = z.infer<typeof districtSchema>;
export const districtsSchema = z
  .array(districtSchema)
  .length(5)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === 5,
    'District IDs must be unique',
  );
export const measureSchema = z.object({
  id: z.string().regex(/^M([1-9]|1[0-4])$/),
  name: z.string(),
  category: z.enum(categories),
  scope: z.enum(['city', 'district']),
  cost: z.number().nonnegative(),
  lag: z.number().int().min(0).max(8),
  effects: z.partialRecord(z.enum(indicatorIds), z.number()),
  description: z.string(),
  notes: z.array(z.string()),
});
export type Measure = z.infer<typeof measureSchema>;
export const measuresSchema = z
  .array(measureSchema)
  .length(14)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === 14,
    'Measure IDs must be unique',
  );
export const decisionSchema = z.object({
  measureId: z.string().regex(/^M([1-9]|1[0-4])$/),
  districtId: districtIdSchema.optional(),
});
export type Decision = z.infer<typeof decisionSchema>;
export const validationSchema = z.object({
  status: z.enum(['valid', 'invalid', 'unverified']),
  errors: z.array(
    z.object({ code: z.string(), message: z.string(), measureIds: z.array(z.string()).optional() }),
  ),
});
export const snapshotSchema = z.object({
  score: z.number().finite(),
  cityAverage: z.number().finite(),
  weakestDistrictId: districtIdSchema,
  criticalCount: z.number().int().nonnegative(),
  districts: districtsSchema,
});
export const simulationSchema = z.object({
  modelVersion: z.string(),
  dataChecksum: z.string().optional(),
  scenarioId: z.string().optional(),
  source: z.enum(['backend', 'fixture']),
  decisions: z.array(decisionSchema),
  validation: validationSchema,
  budget: z.object({ total: z.number(), spent: z.number(), remaining: z.number() }),
  before: snapshotSchema,
  after: snapshotSchema.nullable(),
  scoreDelta: z.number().nullable(),
  synergies: z.array(
    z.object({
      measureIds: z.array(z.string()),
      districtId: districtIdSchema,
      description: z.string(),
    }),
  ),
  contributions: z.array(
    z.object({
      measureId: z.string(),
      districtId: districtIdSchema.optional(),
      scoreImpact: z.number(),
    }),
  ),
  notice: z.string().optional(),
});
export type Simulation = z.infer<typeof simulationSchema>;
export const analysisSchema = z.object({
  source: z.enum(['ai', 'template']),
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  recommendations: z.array(z.string()),
  evidence: z.record(z.string(), z.array(z.string())).optional(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const recommendationSchema = z.object({
  found: z.boolean(),
  explanation: z.string(),
  decisions: z.array(decisionSchema).optional(),
  result: simulationSchema.optional(),
  candidatesChecked: z.number().int().nonnegative(),
  validCandidates: z.number().int().nonnegative(),
  costDelta: z.number().nullable(),
  scoreDelta: z.number().nullable(),
  weakestScoreDelta: z.number().nullable(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;
export const savedScenarioSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  savedAt: z.string(),
  result: simulationSchema,
});
export type SavedScenario = z.infer<typeof savedScenarioSchema>;
