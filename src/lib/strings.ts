export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}


/** Strip common markdown formatting to plain text for display */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/^#{1,6}\s+/gm, "")        // # headings
    .replace(/^\s*[-*+]\s+/gm, "")      // bullet points
    .replace(/^\s*\d+\.\s+/gm, "")      // numbered lists
    .replace(/`(.+?)`/g, "$1")          // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [links](url)
    .replace(/\n{3,}/g, "\n\n")         // excess newlines
    .trim();
}
