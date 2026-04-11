const MARKDOWN_BLOCK_PATTERN =
  /(```[\s\S]*?```|`[^`\n]+`|!\[[^\]]*]\([^)]+\)|\[[^\]]*]\(([^)]+)\)|(^|\n)>\s?.*($|\n)|(^|\n)[*-]\s+|(^|\n)\d+\.\s+|(^|\n)#{1,6}\s+|[*_~]+)/g;

export const stripMarkdown = (value) => {
  if (!value) {
    return "";
  }

  return value
    .replace(MARKDOWN_BLOCK_PATTERN, (match, _full, linkTarget) => linkTarget || " ")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const truncateWords = (value, maxWords = 100) => {
  const normalizedValue = stripMarkdown(value);

  if (!normalizedValue) {
    return "";
  }

  const words = normalizedValue.split(" ");
  if (words.length <= maxWords) {
    return normalizedValue;
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
};
