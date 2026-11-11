export class VersionConflictError extends Error {
  name = 'VersionConflictError';
}
export class ForbiddenTransitionError extends Error {
  name = 'ForbiddenTransitionError';
}
export class AssigneeRequiredError extends Error {
  name = 'AssigneeRequiredError';
}
export class ResolutionRequiredError extends Error {
  name = 'ResolutionRequiredError';
}
export class ReasonRequiredError extends Error {
  name = 'ReasonRequiredError';
}
export class PhotoLimitError extends Error {
  name = 'PhotoLimitError';
}
export class PhotoInvalidError extends Error {
  name = 'PhotoInvalidError';
  constructor(readonly reason: 'mime' | 'size') {
    super(`photo_invalid_${reason}`);
  }
}

export class DuplicateAssetTagError extends Error {
  name = 'DuplicateAssetTagError';
}
// a refusal from the admin-users Edge Function; message is the Thai text it returned
export class AdminError extends Error {
  name = 'AdminError';
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

// keys are the exception messages raised in supabase/migrations
const DB_ERRORS = {
  version_conflict: VersionConflictError,
  forbidden_transition: ForbiddenTransitionError,
  assignee_required: AssigneeRequiredError,
  resolution_required: ResolutionRequiredError,
  reason_required: ReasonRequiredError,
  photo_limit: PhotoLimitError,
} as const;

export function throwDbError(error: { message: string }): never {
  if (Object.hasOwn(DB_ERRORS, error.message)) {
    throw new DB_ERRORS[error.message as keyof typeof DB_ERRORS](error.message, { cause: error });
  }
  throw error instanceof Error ? error : new Error(error.message, { cause: error });
}
