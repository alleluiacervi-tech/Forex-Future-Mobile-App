import { z } from "zod";

const registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    // Card fields are optional on register; if any are provided, all must be provided.
    cardNumber: z.string().min(12).max(19).optional(),
    cardExpMonth: z.number().int().min(1).max(12).optional(),
    cardExpYear: z.number().int().min(new Date().getFullYear()).optional(),
    cardCvc: z.string().min(3).max(4).optional()
  })
  .superRefine((data, ctx) => {
    const cardFields = [data.cardNumber, data.cardExpMonth, data.cardExpYear, data.cardCvc];
    const providedCount = cardFields.filter((value) => value !== undefined && value !== null && value !== "").length;

    if (providedCount > 0 && providedCount < cardFields.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "If providing card details on register, all card fields are required."
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const trialStartSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  cardNumber: z.string().min(12).max(19),
  cardExpMonth: z.number().int().min(1).max(12),
  cardExpYear: z.number().int().min(new Date().getFullYear()),
  cardCvc: z.string().min(3).max(4),
  cardName: z.string().min(2),
  cardPostalCode: z.string().min(3)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  newPassword: z.string().min(8)
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4)
});

const resendVerificationSchema = z.object({
  email: z.string().email()
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
  forgotPasswordSchema,
  loginSchema,
  orderSchema,
  parseSchema,
  recommendationSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  trialStartSchema,
  updateUserSchema,
  verifyEmailSchema
};
