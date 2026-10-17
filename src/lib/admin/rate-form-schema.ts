import { z } from 'zod';

export const rateFormSchema = z.object({
  feeType: z.enum(['ROOM', 'TRASH', 'ELECTRIC', 'WATER']),
  roomNumber: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(32)])
    .transform((value) => (value === '' ? null : value)),
  effectiveYear: z.coerce.number().int().min(2000).max(2100),
  effectiveMonth: z.coerce.number().int().min(1).max(12),
  unitPrice: z.coerce.number().int().min(0),
});

export type RateFormInput = z.infer<typeof rateFormSchema>;
