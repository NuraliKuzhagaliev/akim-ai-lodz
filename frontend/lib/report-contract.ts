import { z } from 'zod';
import { districtIdSchema } from './types';
const finding = z.object({ text: z.string(), evidence: z.array(z.string()) });
export const reportSchema = z.object({
  title: z.string(),
  score_before: z.number().finite(),
  score_after: z.number().finite(),
  score_delta: z.number().finite(),
  budget: z.object({ initial: z.number(), spent: z.number(), remaining: z.number() }),
  decisions: z
    .array(z.object({ measure_id: z.string(), district_id: districtIdSchema.nullable() }))
    .length(5),
  major_improvements: z.array(finding),
  remaining_risks: z.array(finding),
  equity: z.array(finding),
  recommendations: z.array(z.string()),
  markdown: z.string().min(1),
});
export const adviceSchema = z.object({
  priority: z.string(),
  reason: z.string(),
  suggestions: z
    .array(z.object({ measure_id: z.string(), district_id: districtIdSchema.nullable() }))
    .max(3),
  validation_mode: z.literal('individual_additions'),
  base_scenario_id: z.string(),
});
