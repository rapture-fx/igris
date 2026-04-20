export type DocsAudience = 'public' | 'operator' | 'internal';

const audienceRank: Record<DocsAudience, number> = {
  public: 0,
  operator: 1,
  internal: 2,
};

export function normalizeAudience(value: unknown): DocsAudience {
  if (value === 'operator' || value === 'internal') {
    return value;
  }

  return 'public';
}

export function getDocsAudienceMode(): DocsAudience {
  return normalizeAudience(process.env.IGRIS_DOCS_AUDIENCE || process.env.DOCS_AUDIENCE);
}

export function isAudienceVisible(audience: unknown, mode = getDocsAudienceMode()) {
  return audienceRank[normalizeAudience(audience)] <= audienceRank[mode];
}
