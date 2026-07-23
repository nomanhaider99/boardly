import { z } from "zod";

// ─── Shared building blocks (mirrored on client + server) ────────────────────

// Individual password rules — exported so the sign-up UI can render a live
// requirement checklist using the exact same predicates the schema enforces.
export const passwordRules: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
  { label: "One special character (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const passwordSchema = z.string().superRefine((val, ctx) => {
  for (const rule of passwordRules) {
    if (!rule.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.label });
    }
  }
});

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");

// ─── Form schemas ────────────────────────────────────────────────────────────

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
