import YAML from "yaml";
import { buildConfigFromState, type OptionStateMap } from "./sync-job-transformers";

export interface YamlPreviewOptions {
  jobId?: string;
  jobName: string;
  sourceCalendarId: string;
  sourceAccountId: string;
  sourceTimeZone: string;
  destinationCalendarId: string;
  destinationAccountId: string;
  destinationTimeZone: string;
  optionStates: OptionStateMap;
}

export interface CliConfigOptions {
  sourceCalendarId: string;
  sourceAccountId: string;
  destinationCalendarId: string;
  destinationAccountId: string;
  transformers: any[];
  filters: any[];
  authStoragePath?: string;
}

/**
 * Maps our internal transformer/filter types to the CLI's expected format
 */
function mapToCliFormat(items: any[], kind: "transformation" | "filter"): any[] {
  return items.map(item => {
    // Map our internal types to CLI names
    const typeToName: Record<string, string> = {
      // Transformers
      "titleTemplateTransformer": "ReplaceTitle",
      "descriptionNoteTransformer": "KeepDescription", // Approximate mapping
      
      // Filters
      "timeWindowFilter": "TimeFrame",
      "allDayEventFilter": "AllDayEvents",
    };

    const name = typeToName[item.type] || item.type;
    
    // For titleTemplateTransformer, map to ReplaceTitle config
    if (item.type === "titleTemplateTransformer") {
      return {
        name: "ReplaceTitle",
        config: {
          NewTitle: item.template || "{{title}}"
        }
      };
    }
    
    // For descriptionNoteTransformer
    if (item.type === "descriptionNoteTransformer") {
      return {
        name: "KeepDescription"
      };
    }
    
    // For timeWindowFilter
    if (item.type === "timeWindowFilter") {
      return {
        name: "TimeFrame",
        config: {
          HourStart: 0,
          HourEnd: 24
        }
      };
    }
    
    // For allDayEventFilter
    if (item.type === "allDayEventFilter") {
      return {
        name: "AllDayEvents"
      };
    }
    
    // Default: return as-is with name from mapping
    return { name };
  });
}

/**
 * Builds a CLI-compatible configuration object for the calendarsync tool.
 * This is the core function that generates the proper YAML structure.
 */
export function buildCliConfig(options: CliConfigOptions): any {
  // Map transformers and filters to CLI format
  const transformations = mapToCliFormat(options.transformers, "transformation");
  const cliFilters = mapToCliFormat(options.filters, "filter");

  // Get actual OAuth credentials from environment
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables. These are required for CalendarSync CLI."
    );
  }

  // Build the CLI-compatible configuration
  const config: any = {
    sync: {
      start: {
        identifier: "MonthStart",
        offset: -1
      },
      end: {
        identifier: "MonthEnd", 
        offset: 1
      }
    },
    auth: {
      storage_mode: "yaml",
      config: {
        path: options.authStoragePath || "./auth-storage.yaml"
      }
    },
    source: {
      adapter: {
        type: "google",
        calendar: options.sourceCalendarId,
        oAuth: {
          clientId: googleClientId,
          clientKey: googleClientSecret
        }
      }
    },
    sink: {
      adapter: {
        type: "google",
        calendar: options.destinationCalendarId,
        oAuth: {
          clientId: googleClientId,
          clientKey: googleClientSecret
        }
      }
    }
  };

  // Add transformations if any are configured
  if (transformations.length > 0) {
    config.transformations = transformations;
  }

  // Add filters if any are configured
  if (cliFilters.length > 0) {
    config.filters = cliFilters;
  }

  // Add update concurrency
  config.updateConcurrency = 1;

  return config;
}

/**
 * Generates a YAML preview string that matches what will be passed to the calendarsync CLI.
 * This is useful for showing users the configuration that will be used.
 */
export function generateYamlPreview(options: YamlPreviewOptions): string {
  const { transformers, filters } = buildConfigFromState(options.optionStates);

  const config = buildCliConfig({
    sourceCalendarId: options.sourceCalendarId,
    sourceAccountId: options.sourceAccountId,
    destinationCalendarId: options.destinationCalendarId,
    destinationAccountId: options.destinationAccountId,
    transformers,
    filters,
  });

  return YAML.stringify(config, {
    lineWidth: 0, // Prevent line wrapping
    indent: 2,
  });
}

