export interface PageRequest {
  page: number;
  limit: number;
}

export interface PageResult<T> {
  results: T[];
  totalDocs: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function createPageResult<T>(
  results: T[],
  totalDocs: number,
  request: PageRequest,
): PageResult<T> {
  const totalPages = totalDocs === 0 ? 0 : Math.ceil(totalDocs / request.limit);

  return {
    results,
    totalDocs,
    page: request.page,
    totalPages,
    hasNext: request.page < totalPages,
    hasPrev: request.page > 1 && totalPages > 0,
  };
}
