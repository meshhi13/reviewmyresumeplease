export const FIELD_CATEGORIES = [
  {
    value: "engineering",
    label: "Engineering",
    companies: ["Tesla", "SpaceX", "Boeing", "Lockheed Martin", "GE Aerospace", "Ford", "General Motors", "Rivian", "Northrop Grumman", "RTX", "Honeywell", "Siemens"],
  },
  {
    value: "cs",
    label: "Computer Science",
    companies: ["Meta", "Apple", "Amazon", "Netflix", "Google", "Microsoft", "OpenAI", "NVIDIA", "Uber", "Airbnb", "Stripe", "Databricks", "Snowflake", "Salesforce", "Adobe", "Palantir"],
  },
  {
    value: "finance_consulting",
    label: "Finance / Consulting",
    companies: ["Goldman Sachs", "JPMorgan Chase", "Morgan Stanley", "BlackRock", "Citadel", "Jane Street", "McKinsey", "Bain", "Boston Consulting Group", "Deloitte", "PwC", "EY", "KPMG", "Capital One", "Bloomberg"],
  },
] as const;

export type FieldCategory = typeof FIELD_CATEGORIES[number]["value"];

export const ALL_CATEGORY_COMPANIES = Array.from(
  new Map(FIELD_CATEGORIES.flatMap(category => category.companies).map(company => [company.toLowerCase(), company])).values()
);

export const FAANG_PLUS_COMPANIES = FIELD_CATEGORIES.find(category => category.value === "cs")?.companies ?? [];

export function fieldCategoryLabel(value: string | null | undefined) {
  return FIELD_CATEGORIES.find(category => category.value === value)?.label ?? "Computer Science";
}

export function companiesForFieldCategory(value: string | null | undefined) {
  return FIELD_CATEGORIES.find(category => category.value === value)?.companies ?? ALL_CATEGORY_COMPANIES;
}
