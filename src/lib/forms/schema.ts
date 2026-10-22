/**
 * PLICA form schema — the single contract shared by editor, renderer,
 * server validation, exports, PDF and workflows.
 *
 * Answers are stored keyed by field `id` (stable), never by label or key,
 * so renaming a field never orphans existing submissions.
 */
import { z } from "zod";

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "currency",
  "date",
  "time",
  "datetime",
  "date_range",
  "dropdown",
  "single_choice",
  "multi_select",
  "checkboxes",
  "yes_no",
  "name",
  "address",
  "file",
  "signature",
  "rating",
  "slider",
  "matrix",
  "group",
  "calculated",
  "hidden",
  "consent",
  "heading",
  "paragraph",
  "divider",
  "image",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const OptionSchema = z.object({
  id,
  label: z.string().max(500),
  /** Value stored in answers. Defaults to the label when created. */
  value: z.string().max(500),
});
export type Option = z.infer<typeof OptionSchema>;

export const ValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(100_000).optional(),
    maxLength: z.number().int().min(1).max(100_000).optional(),
    /** RE2 syntax, executed with linear-time guarantees (re2js). */
    pattern: z.string().max(500).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    /** ISO date (YYYY-MM-DD) or relative: "today", "+30d", "-18y". */
    minDate: z.string().max(32).optional(),
    maxDate: z.string().max(32).optional(),
    minSelected: z.number().int().min(0).optional(),
    maxSelected: z.number().int().min(1).optional(),
  })
  .strict();
export type Validation = z.infer<typeof ValidationSchema>;

export const MessagesSchema = z
  .object({
    required: z.string().max(300).optional(),
    invalid: z.string().max(300).optional(),
    pattern: z.string().max(300).optional(),
  })
  .strict();

const NAME_PARTS = ["title", "first", "middle", "last", "suffix"] as const;
export type NamePart = (typeof NAME_PARTS)[number];
const ADDRESS_PARTS = ["street", "line2", "postalCode", "city", "state", "country"] as const;
export type AddressPart = (typeof ADDRESS_PARTS)[number];

export const MatrixSchema = z.object({
  rows: z.array(OptionSchema).min(1).max(50),
  columns: z.array(OptionSchema).min(1).max(20),
  multiple: z.boolean().default(false),
});

const baseField = {
  id,
  type: z.enum(FIELD_TYPES),
  /** Machine-friendly key used in API, exports, placeholders ({{key}}). */
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().max(1000).default(""),
  description: z.string().max(4000).optional(),
  placeholder: z.string().max(300).optional(),
  required: z.boolean().optional(),
  /** Default value (shape depends on the type). */
  defaultValue: z.unknown().optional(),
  width: z.enum(["full", "half"]).optional(),
  validation: ValidationSchema.optional(),
  messages: MessagesSchema.optional(),

  // Type specific configuration (kept flat for simple editing).
  options: z.array(OptionSchema).max(500).optional(),
  allowOther: z.boolean().optional(),
  shuffle: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  nameParts: z.array(z.enum(NAME_PARTS)).optional(),
  addressParts: z.array(z.enum(ADDRESS_PARTS)).optional(),
  defaultCountry: z.string().max(64).optional(),
  ratingMax: z.number().int().min(3).max(10).optional(),
  ratingIcon: z.enum(["star", "heart", "number"]).optional(),
  sliderLabels: z.tuple([z.string().max(80), z.string().max(80)]).optional(),
  matrix: MatrixSchema.optional(),
  /** Calculated fields: safe arithmetic expression, e.g. `{price} * {qty}`. */
  expression: z.string().max(2000).optional(),
  /** Hidden fields: allowed URL query parameter used for prefill. */
  urlParam: z.string().max(64).regex(/^[A-Za-z0-9_-]*$/).optional(),
  /** Files. */
  accept: z.array(z.string().max(100)).max(30).optional(),
  maxFiles: z.number().int().min(1).max(20).optional(),
  maxFileSizeMb: z.number().min(0.1).max(100).optional(),
  /** Consent: the exact statement the person agrees to (stored with answer). */
  consentText: z.string().max(10_000).optional(),
  /** Image block. */
  imageUrl: z.string().max(2000).optional(),
  imageAlt: z.string().max(500).optional(),
  /** Heading level for heading blocks. */
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  /** Repeatable groups. */
  minItems: z.number().int().min(0).max(50).optional(),
  maxItems: z.number().int().min(1).max(50).optional(),
  itemLabel: z.string().max(80).optional(),
};

export type Field = {
  id: string;
  type: FieldType;
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  width?: "full" | "half";
  validation?: Validation;
  messages?: z.infer<typeof MessagesSchema>;
  options?: Option[];
  allowOther?: boolean;
  shuffle?: boolean;
  currency?: string;
  decimals?: number;
  nameParts?: NamePart[];
  addressParts?: AddressPart[];
  defaultCountry?: string;
  ratingMax?: number;
  ratingIcon?: "star" | "heart" | "number";
  sliderLabels?: [string, string];
  matrix?: z.infer<typeof MatrixSchema>;
  expression?: string;
  urlParam?: string;
  accept?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
  consentText?: string;
  imageUrl?: string;
  imageAlt?: string;
  level?: 1 | 2 | 3;
  minItems?: number;
  maxItems?: number;
  itemLabel?: string;
  /** Only for `group`: nested fields (one level, no nested groups). */
  fields?: Field[];
};

export const FieldSchema: z.ZodType<Field> = z.lazy(() =>
  z.object({ ...baseField, fields: z.array(FieldSchema).max(50).optional() }),
) as unknown as z.ZodType<Field>;

export const PageSchema = z.object({
  id,
  title: z.string().max(300).default(""),
  description: z.string().max(4000).optional(),
  fields: z.array(FieldSchema).max(300),
});
export type Page = z.infer<typeof PageSchema>;

export const OPERATORS = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "empty",
  "not_empty",
  "in",
  "not_in",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const ConditionSchema = z.object({
  fieldId: id,
  operator: z.enum(OPERATORS),
  /** Strings, numbers, booleans or list (for in / not_in). */
  value: z.union([z.string().max(1000), z.number(), z.boolean(), z.array(z.string().max(500)).max(100)]).optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("show"), target: id }),
  z.object({ type: z.literal("hide"), target: id }),
  z.object({ type: z.literal("require"), target: id }),
  z.object({ type: z.literal("skip_to"), target: id }),
  z.object({ type: z.literal("set_ending"), target: id }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const RuleSchema = z.object({
  id,
  name: z.string().max(200).optional(),
  enabled: z.boolean().default(true),
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(ConditionSchema).min(1).max(30),
  actions: z.array(ActionSchema).min(1).max(30),
});
export type Rule = z.infer<typeof RuleSchema>;

export const EndingSchema = z.object({
  id,
  title: z.string().max(300),
  /** Plain text with {{key}} placeholders, rendered escaped. */
  body: z.string().max(10_000).default(""),
  redirectUrl: z.string().max(2000).optional(),
});
export type Ending = z.infer<typeof EndingSchema>;

export const ThemeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b5bdb"),
  radius: z.enum(["none", "small", "medium", "large"]).default("medium"),
  font: z.enum(["sans", "serif", "mono"]).default("sans"),
  background: z.enum(["plain", "tinted"]).default("plain"),
  logoFileId: z.string().max(64).optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const SettingsSchema = z.object({
  mode: z.enum(["classic", "cards", "wizard"]).default("classic"),
  showProgress: z.boolean().default(true),
  /** Wizard: show a review step before submitting. */
  reviewStep: z.boolean().default(true),
  submitLabel: z.string().max(80).default("Absenden"),
  language: z.enum(["de", "en"]).default("de"),
  /** Allow respondents to save and resume via a private link. */
  allowResume: z.boolean().default(false),
  theme: ThemeSchema.default({ accent: "#3b5bdb", radius: "medium", font: "sans", background: "plain" }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const FormSchemaV1 = z.object({
  version: z.literal(1),
  title: z.string().max(300),
  description: z.string().max(4000).optional(),
  pages: z.array(PageSchema).min(1).max(50),
  rules: z.array(RuleSchema).max(200).default([]),
  endings: z.array(EndingSchema).min(1).max(20),
  settings: SettingsSchema,
});
export type FormDefinition = z.infer<typeof FormSchemaV1>;

/** Fields that collect no answer. */
export const DISPLAY_TYPES: ReadonlySet<FieldType> = new Set(["heading", "paragraph", "divider", "image"]);

export function isInputField(f: Pick<Field, "type">): boolean {
  return !DISPLAY_TYPES.has(f.type);
}

/** Iterate all fields (including group children) with their page. */
export function* walkFields(def: Pick<FormDefinition, "pages">): Generator<{ field: Field; page: Page; parent?: Field }> {
  for (const page of def.pages) {
    for (const field of page.fields) {
      yield { field, page };
      if (field.type === "group") for (const child of field.fields ?? []) yield { field: child, page, parent: field };
    }
  }
}

export function fieldIndex(def: Pick<FormDefinition, "pages">): Map<string, { field: Field; page: Page; parent?: Field }> {
  const map = new Map<string, { field: Field; page: Page; parent?: Field }>();
  for (const entry of walkFields(def)) map.set(entry.field.id, entry);
  return map;
}

/** Parse untrusted JSON into a definition; throws ZodError with paths. */
export function parseDefinition(input: unknown): FormDefinition {
  return FormSchemaV1.parse(input);
}
