// BFF returns enriched tag objects (e.g. profiles.industry on the GET response)
// as `Optional[Dict[str, Any]]`, which serialises as `Record<string, never>` in
// the generated OpenAPI types — useless for property access. This is the shape
// the upstream User service actually emits (its TagVO model). Use this when
// reading enriched fields from the BFF profile response.
export interface TagVO {
  id: number;
  kind: string;
  subject_group: string | null;
  subject?: string | null;
  language?: string | null;
  desc?: Record<string, unknown> | null;
  parent_subject_group?: string | null;
}
