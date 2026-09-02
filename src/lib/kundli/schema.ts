import { z } from "zod";

const latitudeSchema = z.coerce.number().min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90.");
const longitudeSchema = z.coerce.number().min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180.");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const birthDetailsSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a valid full name.").max(80, "Name is too long."),
    gender: z.string().trim().max(24, "Gender value is too long.").optional().or(z.literal("")),
    dateOfBirth: z.string().regex(datePattern, "Enter a valid date of birth."),
    timeOfBirth: z.string().regex(timePattern, "Enter a valid time of birth."),
    timeAccuracy: z.enum(["EXACT", "APPROXIMATE", "UNKNOWN"]).default("EXACT"),
    placeId: z.string().trim().min(1, "Select a resolved birth place."),
    displayName: z.string().trim().optional().or(z.literal("")),
    city: z.string().trim().optional().or(z.literal("")),
    region: z.string().trim().optional().or(z.literal("")),
    country: z.string().trim().optional().or(z.literal("")),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    timezone: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    const date = new Date(`${value.dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid calendar date." });
      return;
    }

    const [year, month, day] = value.dateOfBirth.split("-").map(Number);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
      context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a real calendar date." });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (date >= tomorrow) {
      context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth cannot be in the future." });
    }
  });

export type BirthDetailsInput = z.input<typeof birthDetailsSchema>;
export type ValidatedBirthDetails = z.output<typeof birthDetailsSchema>;

export const resolvedLocationSchema = z.object({
  displayName: z.string().trim().min(2, "Resolved place name is required."),
  city: z.string().trim().min(1, "Resolved city is required."),
  region: z.string().trim().optional(),
  country: z.string().trim().min(2, "Resolved country is required."),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  timezone: z.string().trim().min(2, "Resolved timezone is required."),
});

export function parseBirthDetailsForm(formData: FormData) {
  return birthDetailsSchema.safeParse(Object.fromEntries(formData.entries()));
}
