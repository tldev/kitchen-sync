import type { CalendarSyncConfig } from "./calendarsync/executor";

const PLACEHOLDER_TITLE_TOKEN = "{{title}}";

type OptionKind = "transformer" | "filter";

type FieldType = "text" | "textarea" | "number" | "select" | "checkbox";

type FieldValue = string | number | boolean;

type FieldValueMap = Record<string, FieldValue>;

interface BaseFieldDefinition {
  id: string;
  label: string;
  helperText?: string;
  required?: boolean;
}

interface TextFieldDefinition extends BaseFieldDefinition {
  type: "text" | "textarea";
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
}

interface NumberFieldDefinition extends BaseFieldDefinition {
  type: "number";
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}

interface SelectFieldDefinition extends BaseFieldDefinition {
  type: "select";
  options: readonly { value: string; label: string; description?: string }[];
  defaultValue: string;
}

interface CheckboxFieldDefinition extends BaseFieldDefinition {
  type: "checkbox";
  defaultValue?: boolean;
}

type FieldDefinition =
  | TextFieldDefinition
  | NumberFieldDefinition
  | SelectFieldDefinition
  | CheckboxFieldDefinition;

interface OptionDefinitionBase<K extends OptionKind> {
  id: string;
  kind: K;
  label: string;
  description: string;
  defaultEnabled?: boolean;
  helperText?: string;
  fields: readonly FieldDefinition[];
  summarize(values: FieldValueMap): string;
  toConfig(values: FieldValueMap): CalendarSyncConfig | null;
  validate?(values: FieldValueMap): string[];
}

type TransformerOptionDefinition = OptionDefinitionBase<"transformer">;
type FilterOptionDefinition = OptionDefinitionBase<"filter">;

type OptionDefinition = TransformerOptionDefinition | FilterOptionDefinition;

interface OptionState {
  enabled: boolean;
  values: FieldValueMap;
}

type OptionStateMap = Record<string, OptionState>;

interface SanitizedConfig {
  transformers: CalendarSyncConfig[];
  filters: CalendarSyncConfig[];
}

function getDefaultValue(field: FieldDefinition): FieldValue {
  switch (field.type) {
    case "text":
    case "textarea":
      return field.defaultValue ?? "";
    case "number":
      return field.defaultValue ?? 0;
    case "select":
      return field.defaultValue;
    case "checkbox":
      return field.defaultValue ?? false;
    default:
      return "";
  }
}

const OPTION_DEFINITIONS: readonly OptionDefinition[] = [
  {
    id: "titleTemplate",
    kind: "transformer",
    label: "Title template",
    description:
      "Add a prefix or suffix around the original event title so synced entries are easy to distinguish.",
    helperText:
      "CalendarSync will substitute the original title into the template and optionally convert it to uppercase.",
    fields: [
      {
        id: "prefix",
        type: "text",
        label: "Prefix",
        placeholder: "[Synced] ",
        defaultValue: "[Synced] ",
        maxLength: 40,
      },
      {
        id: "suffix",
        type: "text",
        label: "Suffix",
        placeholder: " (copy)",
        defaultValue: "",
        maxLength: 40,
      },
      {
        id: "uppercase",
        type: "checkbox",
        label: "Transform final title to uppercase",
        defaultValue: false,
        helperText: "Useful when mirrored events should stand out in the destination calendar.",
      },
    ],
    summarize(values) {
      const prefix = String(values.prefix ?? "").trim();
      const suffix = String(values.suffix ?? "").trim();
      const uppercase = Boolean(values.uppercase);
      const parts: string[] = [];

      if (prefix) {
        parts.push(`adds prefix "${prefix}"`);
      }
      if (suffix) {
        parts.push(`adds suffix "${suffix}"`);
      }
      if (uppercase) {
        parts.push("converts titles to uppercase");
      }

      if (parts.length === 0) {
        return "Uses the original title without modifications.";
      }

      return `Title template ${parts.join(" and ")}.`;
    },
    toConfig(values) {
      const prefix = String(values.prefix ?? "");
      const suffix = String(values.suffix ?? "");
      const uppercase = Boolean(values.uppercase);
      const template = `${prefix}${PLACEHOLDER_TITLE_TOKEN}${suffix}`;

      return {
        type: "titleTemplateTransformer",
        template,
        prefix,
        suffix,
        uppercase,
      } satisfies CalendarSyncConfig;
    },
  },
  {
    id: "descriptionNote",
    kind: "transformer",
    label: "Description note",
    description:
      "Append or prepend a note to the event description to document how the entry reached the destination calendar.",
    helperText:
      "Ideal for letting collaborators know that updates should be made in the source calendar instead of the mirrored copy.",
    fields: [
      {
        id: "note",
        type: "textarea",
        label: "Note text",
        defaultValue: "This event is synchronised by Kitchen Sync.",
        required: true,
        maxLength: 280,
      },
      {
        id: "placement",
        type: "select",
        label: "Placement",
        options: [
          { value: "APPEND", label: "Append to the end of the description" },
          { value: "PREPEND", label: "Prepend to the beginning of the description" },
        ],
        defaultValue: "APPEND",
      },
    ],
    summarize(values) {
      const note = String(values.note ?? "").trim();
      const placement = values.placement === "PREPEND" ? "prepended" : "appended";
      if (!note) {
        return "Note text not provided.";
      }
      return `${placement.charAt(0).toUpperCase()}${placement.slice(1)} note "${note}" to the description.`;
    },
    validate(values) {
      const errors: string[] = [];
      const note = String(values.note ?? "").trim();
      if (!note) {
        errors.push("Provide a note to include in the event description.");
      }
      return errors;
    },
    toConfig(values) {
      const note = String(values.note ?? "").trim();
      const placement = values.placement === "PREPEND" ? "PREPEND" : "APPEND";
      return {
        type: "descriptionNoteTransformer",
        note,
        placement,
      } satisfies CalendarSyncConfig;
    },
  },
  {
    id: "timeWindow",
    kind: "filter",
    label: "Time window filter",
    description:
      "Limit syncing to events inside a rolling window so historical data or distant future plans are ignored.",
    helperText:
      "Recommended for keeping destination calendars focused on the upcoming schedule.",
    fields: [
      {
        id: "pastDays",
        type: "number",
        label: "Include events from the past (days)",
        defaultValue: 7,
        min: 0,
        max: 365,
        step: 1,
      },
      {
        id: "futureDays",
        type: "number",
        label: "Include events in the future (days)",
        defaultValue: 30,
        min: 1,
        max: 730,
        step: 1,
        required: true,
      },
    ],
    summarize(values) {
      const pastDays = Number(values.pastDays ?? 0);
      const futureDays = Number(values.futureDays ?? 0);
      const pastPart = pastDays > 0 ? `${pastDays} day${pastDays === 1 ? "" : "s"} of history` : "no history";
      return `Syncs ${pastPart} and the next ${futureDays} day${futureDays === 1 ? "" : "s"}.`;
    },
    validate(values) {
      const errors: string[] = [];
      const pastDays = Number(values.pastDays ?? 0);
      const futureDays = Number(values.futureDays ?? 0);
      if (!Number.isFinite(pastDays) || pastDays < 0) {
        errors.push("Past days must be zero or a positive integer.");
      }
      if (!Number.isFinite(futureDays) || futureDays <= 0) {
        errors.push("Future days must be greater than zero.");
      }
      if (pastDays > 365) {
        errors.push("Past days cannot exceed 365.");
      }
      if (futureDays > 730) {
        errors.push("Future days cannot exceed 730.");
      }
      return errors;
    },
    toConfig(values) {
      const pastDays = Math.max(0, Math.min(365, Number(values.pastDays ?? 0)));
      const futureDays = Math.max(1, Math.min(730, Number(values.futureDays ?? 1)));
      return {
        type: "timeWindowFilter",
        pastDays,
        futureDays,
      } satisfies CalendarSyncConfig;
    },
  },
  {
    id: "allDay",
    kind: "filter",
    label: "All-day event filter",
    description: "Exclude all-day events when mirroring calendars to avoid duplicating day blockers.",
    helperText:
      "Great for destination calendars that should only include time-bound meetings and omit OOO blocks or reminders.",
    defaultEnabled: true,
    fields: [
      {
        id: "exclude",
        type: "checkbox",
        label: "Skip all-day events",
        defaultValue: true,
      },
    ],
    summarize(values) {
      return Boolean(values.exclude)
        ? "Skips all-day events from being copied."
        : "Keeps all-day events in the sync.";
    },
    toConfig(values) {
      const exclude = Boolean(values.exclude);
      return {
        type: "allDayEventFilter",
        exclude,
      } satisfies CalendarSyncConfig;
    },
  },
] as const;

type OptionId = (typeof OPTION_DEFINITIONS)[number]["id"];

function createDefaultStateForDefinition(definition: OptionDefinition): OptionState {
  const values: FieldValueMap = {};
  for (const field of definition.fields) {
    values[field.id] = getDefaultValue(field);
  }
  return {
    enabled: definition.defaultEnabled ?? false,
    values,
  } satisfies OptionState;
}

function createDefaultOptionState(): OptionStateMap {
  return OPTION_DEFINITIONS.reduce<OptionStateMap>((accumulator, definition) => {
    accumulator[definition.id] = createDefaultStateForDefinition(definition);
    return accumulator;
  }, {});
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function validateField(
  field: FieldDefinition,
  rawValue: unknown,
  enabled: boolean,
): { value: FieldValue; errors: string[] } {
  const errors: string[] = [];
  const fallback = getDefaultValue(field);

  if (rawValue === undefined || rawValue === null) {
    if (enabled && field.required) {
      errors.push(`${field.label} is required.`);
    }
    return { value: fallback, errors };
  }

  switch (field.type) {
    case "text":
    case "textarea": {
      if (typeof rawValue !== "string") {
        errors.push(`${field.label} must be a string.`);
        return { value: fallback, errors };
      }
      if (field.maxLength && rawValue.length > field.maxLength) {
        errors.push(`${field.label} must be ${field.maxLength} characters or fewer.`);
      }
      return { value: rawValue, errors };
    }
    case "number": {
      let numeric = rawValue;
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        numeric = Number(rawValue);
      }
      if (typeof numeric !== "number" || Number.isNaN(numeric)) {
        errors.push(`${field.label} must be a number.`);
        return { value: fallback, errors };
      }
      if (field.min !== undefined && numeric < field.min) {
        errors.push(`${field.label} must be greater than or equal to ${field.min}.`);
      }
      if (field.max !== undefined && numeric > field.max) {
        errors.push(`${field.label} must be less than or equal to ${field.max}.`);
      }
      return { value: numeric, errors };
    }
    case "select": {
      if (typeof rawValue !== "string") {
        errors.push(`${field.label} must be one of the provided options.`);
        return { value: fallback, errors };
      }
      const found = field.options.some((option) => option.value === rawValue);
      if (!found) {
        errors.push(`${field.label} must be one of the provided options.`);
        return { value: fallback, errors };
      }
      return { value: rawValue, errors };
    }
    case "checkbox": {
      if (typeof rawValue !== "boolean") {
        errors.push(`${field.label} must be true or false.`);
        return { value: fallback, errors };
      }
      return { value: rawValue, errors };
    }
    default:
      return { value: fallback, errors };
  }
}

function parseOption(
  definition: OptionDefinition,
  rawValue: unknown,
): { state: OptionState; errors: string[] } {
  const defaultState = createDefaultStateForDefinition(definition);

  if (rawValue === undefined || rawValue === null) {
    return { state: defaultState, errors: [] };
  }

  if (typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {
      state: defaultState,
      errors: [`${definition.label} must be an object.`],
    };
  }

  const rawRecord = rawValue as Record<string, unknown>;
  const enabled = coerceBoolean(rawRecord.enabled, defaultState.enabled);
  const values: FieldValueMap = {};
  const errors: string[] = [];

  for (const field of definition.fields) {
    const { value, errors: fieldErrors } = validateField(field, rawRecord[field.id], enabled);
    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors.map((message) => `${definition.label}: ${message}`));
    }
    values[field.id] = value;
  }

  if (enabled && definition.validate) {
    const validationErrors = definition.validate(values);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors.map((message) => `${definition.label}: ${message}`));
    }
  }

  return {
    state: {
      enabled,
      values,
    },
    errors,
  };
}

function buildConfigFromState(state: OptionStateMap): SanitizedConfig {
  const sanitized: SanitizedConfig = { transformers: [], filters: [] };

  for (const definition of OPTION_DEFINITIONS) {
    const optionState = state[definition.id];
    if (!optionState || !optionState.enabled) {
      continue;
    }
    const config = definition.toConfig(optionState.values);
    if (!config) {
      continue;
    }
    if (definition.kind === "transformer") {
      sanitized.transformers.push(config);
    } else {
      sanitized.filters.push(config);
    }
  }

  return sanitized;
}

function validateConfigPayload(rawConfig: unknown): { success: true; config: SanitizedConfig } | { success: false; errors: string[] } {
  if (rawConfig === null || rawConfig === undefined) {
    return { success: true, config: { transformers: [], filters: [] } };
  }

  if (typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return {
      success: false,
      errors: ["Config must be an object mapping option identifiers to their settings."],
    };
  }

  const rawRecord = rawConfig as Record<string, unknown>;
  const state: OptionStateMap = createDefaultOptionState();
  const errors: string[] = [];

  for (const definition of OPTION_DEFINITIONS) {
    const { state: optionState, errors: optionErrors } = parseOption(definition, rawRecord[definition.id]);
    state[definition.id] = optionState;
    if (optionErrors.length > 0) {
      errors.push(...optionErrors);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, config: buildConfigFromState(state) };
}

function createSummary(state: OptionStateMap): { transformers: string[]; filters: string[] } {
  const transformers: string[] = [];
  const filters: string[] = [];

  for (const definition of OPTION_DEFINITIONS) {
    const optionState = state[definition.id];
    if (!optionState || !optionState.enabled) {
      continue;
    }
    const summary = definition.summarize(optionState.values);
    if (summary) {
      if (definition.kind === "transformer") {
        transformers.push(summary);
      } else {
        filters.push(summary);
      }
    }
  }

  return { transformers, filters };
}

export type {
  FieldDefinition,
  FieldType,
  FieldValue,
  FieldValueMap,
  OptionDefinition,
  OptionId,
  OptionKind,
  OptionState,
  OptionStateMap,
  SanitizedConfig,
};
export {
  OPTION_DEFINITIONS,
  buildConfigFromState,
  createDefaultOptionState,
  createSummary,
  validateConfigPayload,
};
