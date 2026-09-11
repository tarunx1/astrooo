import "server-only";

import { CourseLevel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

/**
 * Courses.
 *
 * Every public read filters on `active`, so an unpublished course is invisible
 * by construction.
 *
 * There is deliberately no progress tracking here. This application has no
 * lesson delivery and therefore no way to know what anyone has completed;
 * showing a percentage would be showing a number nobody measured. The learner
 * area lists what they are enrolled in and what each course covers, which is
 * everything that is actually true today.
 */
export const syllabusModuleSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(400).nullable().optional(),
  /** Lesson titles, when the outline goes that deep. */
  lessons: z.array(z.string().trim().min(1).max(160)).max(40).optional(),
});

export type SyllabusModule = z.infer<typeof syllabusModuleSchema>;

/** Parses a stored outline, tolerating a shape written before a field existed. */
export function parseSyllabus(value: Prisma.JsonValue | null): SyllabusModule[] {
  const parsed = z.array(syllabusModuleSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const COURSE_LEVEL_LABEL: Record<CourseLevel, string> = {
  [CourseLevel.BEGINNER]: "Beginner",
  [CourseLevel.INTERMEDIATE]: "Intermediate",
  [CourseLevel.ADVANCED]: "Advanced",
};

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  level: CourseLevel;
  instructorName: string | null;
  coverImageUrl: string | null;
  durationMinutes: number | null;
  pricePaise: number;
  currency: string;
  isFree: boolean;
  /** Counted from the stored outline. Absent rather than guessed when empty. */
  moduleCount: number;
  lessonCount: number;
};

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  level: true,
  instructorName: true,
  coverImageUrl: true,
  durationMinutes: true,
  pricePaise: true,
  currency: true,
  syllabus: true,
} satisfies Prisma.CourseSelect;

function toCard(row: Prisma.CourseGetPayload<{ select: typeof CARD_SELECT }>): CourseCardData {
  const modules = parseSyllabus(row.syllabus);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription || `${row.description.slice(0, 140)}…`,
    level: row.level,
    instructorName: row.instructorName,
    coverImageUrl: row.coverImageUrl,
    durationMinutes: row.durationMinutes,
    pricePaise: row.pricePaise,
    currency: row.currency,
    isFree: row.pricePaise === 0,
    moduleCount: modules.length,
    lessonCount: modules.reduce((total, module) => total + (module.lessons?.length ?? 0), 0),
  };
}

export async function listCourses(): Promise<CourseCardData[]> {
  const rows = await prisma.course.findMany({
    where: { active: true },
    select: CARD_SELECT,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: 60,
  });

  return rows.map(toCard);
}

export type CourseDetailData = CourseCardData & {
  description: string;
  syllabus: SyllabusModule[];
};

export async function getCourse(slug: string): Promise<CourseDetailData | null> {
  const row = await prisma.course.findFirst({ where: { slug, active: true }, select: CARD_SELECT });
  if (!row) return null;

  return { ...toCard(row), description: row.description, syllabus: parseSyllabus(row.syllabus) };
}

/* ------------------------------------------------------------------ */
/* Enrolment                                                           */
/* ------------------------------------------------------------------ */

export type EnrolmentResult =
  | { ok: true; enrollmentId: string; alreadyEnrolled: boolean }
  | { ok: false; message: string; requiresPayment?: boolean };

/**
 * Enrols a learner in a free course.
 *
 * Refuses a paid course outright rather than quietly enrolling without payment.
 * Idempotent: the unique constraint on `(userId, courseId)` means a double
 * submit produces one enrolment, and the second attempt reports success because
 * the desired state - enrolled - is what the learner asked for either way.
 */
export async function enrolInFreeCourse(input: {
  userId: string;
  courseId: string;
}): Promise<EnrolmentResult> {
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, active: true },
    select: { id: true, pricePaise: true, currency: true },
  });

  if (!course) return { ok: false, message: "That course is not available." };

  if (course.pricePaise > 0) {
    return {
      ok: false,
      requiresPayment: true,
      message: "This course requires payment.",
    };
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: input.userId,
        courseId: course.id,
        pricePaise: 0,
        currency: course.currency,
        // A free enrolment is complete the moment it is made; there is no
        // payment to wait for.
        paidAt: new Date(),
      },
      select: { id: true },
    });

    return { ok: true, enrollmentId: enrollment.id, alreadyEnrolled: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: input.userId, courseId: course.id } },
        select: { id: true },
      });

      if (existing) return { ok: true, enrollmentId: existing.id, alreadyEnrolled: true };
    }
    throw error;
  }
}

export type EnrolmentView = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  level: CourseLevel;
  coverImageUrl: string | null;
  instructorName: string | null;
  moduleCount: number;
  enrolledAt: Date;
  isFree: boolean;
};

/** One learner's own enrolments. Scoped by `userId` in the query. */
export async function listEnrolments(userId: string): Promise<EnrolmentView[]> {
  const rows = await prisma.enrollment.findMany({
    where: { userId },
    select: {
      id: true,
      courseId: true,
      createdAt: true,
      pricePaise: true,
      course: {
        select: {
          slug: true,
          title: true,
          level: true,
          coverImageUrl: true,
          instructorName: true,
          syllabus: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    courseId: row.courseId,
    slug: row.course.slug,
    title: row.course.title,
    level: row.course.level,
    coverImageUrl: row.course.coverImageUrl,
    instructorName: row.course.instructorName,
    moduleCount: parseSyllabus(row.course.syllabus).length,
    enrolledAt: row.createdAt,
    isFree: row.pricePaise === 0,
  }));
}

export async function isEnrolled(input: { userId: string; courseId: string }): Promise<boolean> {
  const row = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    select: { id: true },
  });

  return row !== null;
}
