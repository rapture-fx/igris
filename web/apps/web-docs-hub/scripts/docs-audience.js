const allowedAudiences = new Set(['public', 'operator', 'internal']);
const audienceRank = {
  public: 0,
  operator: 1,
  internal: 2,
};

function normalizeAudience(value) {
  if (typeof value !== 'string') {
    return 'public';
  }

  const normalized = value.trim().toLowerCase();
  return allowedAudiences.has(normalized) ? normalized : 'public';
}

function getDocsAudienceMode() {
  return normalizeAudience(process.env.IGRIS_DOCS_AUDIENCE || process.env.DOCS_AUDIENCE || 'public');
}

function isAudienceVisible(audience, mode = getDocsAudienceMode()) {
  return audienceRank[normalizeAudience(audience)] <= audienceRank[normalizeAudience(mode)];
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match) {
    return { body: content, data: {} };
  }

  const data = {};
  for (const line of match[1].split('\n')) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!keyMatch) continue;
    const [, key, rawValue] = keyMatch;
    data[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }

  return {
    body: content.slice(match[0].length),
    data,
  };
}

function isContentVisible(content, mode = getDocsAudienceMode()) {
  const { data } = parseFrontmatter(content);
  return isAudienceVisible(data.audience, mode);
}

module.exports = {
  allowedAudiences,
  getDocsAudienceMode,
  isAudienceVisible,
  isContentVisible,
  normalizeAudience,
  parseFrontmatter,
};
