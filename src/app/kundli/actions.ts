"use server";

import { redirect } from "next/navigation";
import type { BirthDetailsInput } from "@/lib/kundli/schema";
import { generateKundli } from "@/lib/kundli/service";

export type BirthDetailsFormState = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

export async function submitBirthDetails(_: BirthDetailsFormState, formData: FormData): Promise<BirthDetailsFormState> {
  const result = await generateKundli(Object.fromEntries(formData.entries()) as BirthDetailsInput);

  if (result.ok) {
    redirect(`/kundli/result/${result.id}`);
  }

  return {
    formErrors: result.formErrors,
    fieldErrors: result.fieldErrors,
  };
}
