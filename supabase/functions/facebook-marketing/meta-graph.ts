export type GraphPage<T> = {
  data?: T[];
  paging?: {
    next?: string | null;
    cursors?: { after?: string | null };
  };
};

export type GraphPagesResult<T> = {
  data: T[];
  pagesFetched: number;
  truncated: boolean;
};

/**
 * Collect cursor-paginated Graph API results without trusting paging.next as
 * a request URL. The caller supplies each page fetch so credentials and
 * appsecret_proof remain controlled by the Edge Function.
 */
export async function fetchAllGraphPages<T>(
  fetchPage: (after?: string) => Promise<GraphPage<T>>,
  maxPages = 20,
): Promise<GraphPagesResult<T>> {
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("maxPages must be a positive integer.");
  }

  const items: T[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const result = await fetchPage(after);
    if (Array.isArray(result.data)) items.push(...result.data);

    if (!result.paging?.next) {
      return { data: items, pagesFetched: pageNumber + 1, truncated: false };
    }

    const next = result.paging.cursors?.after;
    if (typeof next !== "string" || !next || seenCursors.has(next)) {
      return { data: items, pagesFetched: pageNumber + 1, truncated: true };
    }

    seenCursors.add(next);
    after = next;
  }

  return { data: items, pagesFetched: maxPages, truncated: true };
}
