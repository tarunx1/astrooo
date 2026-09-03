import type { CompatibilityResult, PanchangResult, SadeSatiResult } from "@/lib/astrology/tool-types";
import type { BirthInsight } from "@/lib/astrology/tools-service";
import type { NumerologyResult } from "@/lib/numerology/types";

/**
 * Action state shapes for the tool forms.
 *
 * Kept outside the `"use server"` files: such a file may only export async
 * functions, so exporting a constant from one breaks at runtime even though it
 * typechecks.
 */
export type FormErrors = { formErrors: string[]; fieldErrors: Record<string, string[]> };

export const NO_ERRORS: FormErrors = { formErrors: [], fieldErrors: {} };

export type BirthToolState = FormErrors & { result: BirthInsight | null };
export const INITIAL_BIRTH_TOOL_STATE: BirthToolState = { ...NO_ERRORS, result: null };

export type SadeSatiState = FormErrors & { result: SadeSatiResult | null };
export const INITIAL_SADE_SATI_STATE: SadeSatiState = { ...NO_ERRORS, result: null };

export type CompatibilityState = FormErrors & { result: CompatibilityResult | null };
export const INITIAL_COMPATIBILITY_STATE: CompatibilityState = { ...NO_ERRORS, result: null };

export type PanchangState = FormErrors & { result: PanchangResult | null };
export const INITIAL_PANCHANG_STATE: PanchangState = { ...NO_ERRORS, result: null };

export type NumerologyState = FormErrors & { result: NumerologyResult | null };
export const INITIAL_NUMEROLOGY_STATE: NumerologyState = { ...NO_ERRORS, result: null };
