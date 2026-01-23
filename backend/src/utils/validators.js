import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const trialStartSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const orderSchema = z.object({
  pair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/),
  side: z.enum(["buy", "sell"]),
  units: z.number().positive()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  settings: z
    .object({
      baseCurrency: z.string().optional(),
      riskLevel: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      notifications: z.boolean().optional()
    })
    .optional()
});

const recommendationSchema = z.object({
  pair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/),
  timeframe: z.string().min(2).optional(),
  currentPrice: z.number().positive().optional(),
  accountBalance: z.number().positive().optional(),
  riskPercent: z.number().positive().max(10).optional(),
  notes: z.string().optional()
});

const parseSchema = (schema, payload) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      error: result.error.issues.map((issue) => issue.message).join(", ")
    };
  }
  return { data: result.data };
};

export {
  loginSchema,
  orderSchema,
  parseSchema,
  recommendationSchema,
  registerSchema,
  trialStartSchema,
  updateUserSchema
};
