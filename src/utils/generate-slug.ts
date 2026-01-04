export function generateSlug(title: string): string {
  return title
    .toLowerCase() // convert to lowercase
    .trim() // remove leading/trailing spaces
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with '-'
    .replace(/^-+|-+$/g, "") // remove leading/trailing '-'
    .replace(/-{2,}/g, "-"); // collapse multiple '-' into one
}
