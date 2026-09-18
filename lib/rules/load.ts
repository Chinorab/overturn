import federal from "@/data/rules/federal.json";
import nsa from "@/data/rules/nsa.json";
import ca from "@/data/rules/ca.json";
import ny from "@/data/rules/ny.json";
import tx from "@/data/rules/tx.json";
import help from "@/data/help-resources.json";
import glossary from "@/data/glossary.json";
import { HelpResourceFile, RuleFile, type HelpResource, type Rule } from "./schema";

/**
 * The rules dataset, validated once at module load. A malformed rule (missing source,
 * bad date, unknown field) throws here, which fails the build and the tests.
 */
export const RULE_FILES = { federal, nsa, ca, ny, tx } as const;

export const ALL_RULES: Rule[] = Object.values(RULE_FILES).flatMap((file) => RuleFile.parse(file));

export const HELP_RESOURCES: HelpResource[] = HelpResourceFile.parse(help);

export const GLOSSARY: Record<string, string> = glossary;

const ids = ALL_RULES.map((r) => r.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`Duplicate rule ids: ${dupes.join(", ")}`);
