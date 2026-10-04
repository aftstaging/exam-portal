/**
 * Search terms reach the database as SQL `LIKE` patterns. MySQL treats `%` and `_`
 * as wildcards inside a pattern, so an unescaped term silently changes what the
 * admin is searching for: "50%" would match every name containing "50", and "a_b"
 * would match "axb". Escaping the wildcards keeps the search literal.
 *
 * The escape character is the MySQL default backslash. That is correct here because
 * the term travels as a bound parameter: the backslashes survive string-literal
 * parsing untouched and are then consumed by the `LIKE` pattern parser, which is
 * the single pass we want.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Wraps a term in wildcards after escaping it, ready to hand to `like`. */
export function containsPattern(term: string): string {
  return `%${escapeLikePattern(term)}%`;
}
