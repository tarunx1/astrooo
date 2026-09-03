/**
 * Admin action result.
 *
 * Lives outside the `"use server"` file because such a file may only export
 * async functions; exporting a constant from one breaks at runtime even though
 * it typechecks.
 */
export type AdminActionState = {
  ok: boolean;
  error: string | null;
  message?: string;
  fieldErrors: Record<string, string[]>;
};

export const INITIAL_ADMIN_STATE: AdminActionState = { ok: false, error: null, fieldErrors: {} };
