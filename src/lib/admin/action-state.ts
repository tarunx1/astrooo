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
  /**
   * What the operator actually typed, returned with a failure so the form can
   * put it back.
   *
   * React resets a form once its action resolves. On a rejected submit that
   * wiped every field and left the operator staring at validation errors
   * against boxes they could no longer see the contents of - so the only way
   * to correct one mistake was to retype the whole product.
   */
  values?: Record<string, string>;
};

export const INITIAL_ADMIN_STATE: AdminActionState = { ok: false, error: null, fieldErrors: {} };
