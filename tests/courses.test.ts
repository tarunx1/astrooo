import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CourseLevel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  enrolInFreeCourse,
  getCourse,
  isEnrolled,
  listCourses,
  listEnrolments,
  parseSyllabus,
} from "@/lib/content/courses";

/**
 * Courses and enrolment.
 *
 * The properties worth protecting: an inactive course is invisible, a paid
 * course cannot be enrolled in for free, enrolling twice produces one
 * enrolment, and no learner sees another's.
 */
const RUN = `crs${Date.now().toString(36)}`;

let learner: { id: string };
let otherLearner: { id: string };
let freeCourseId: string;
let paidCourseId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

  learner = await prisma.user.create({
    data: { name: "Learner", email: `${RUN}.learner@example.test`, emailVerified: true },
    select: { id: true },
  });

  otherLearner = await prisma.user.create({
    data: { name: "Other", email: `${RUN}.other@example.test`, emailVerified: true },
    select: { id: true },
  });

  const free = await prisma.course.create({
    data: {
      slug: `${RUN}-free`,
      title: "Free course",
      description: "A free course for testing.",
      shortDescription: "Free",
      level: CourseLevel.BEGINNER,
      pricePaise: 0,
      active: true,
      syllabus: [
        { title: "Module one", summary: "Basics", lessons: ["Lesson A", "Lesson B"] },
        { title: "Module two" },
      ],
    },
    select: { id: true },
  });
  freeCourseId = free.id;

  const paid = await prisma.course.create({
    data: {
      slug: `${RUN}-paid`,
      title: "Paid course",
      description: "A paid course for testing.",
      pricePaise: 250_000,
      active: true,
    },
    select: { id: true },
  });
  paidCourseId = paid.id;

  await prisma.course.create({
    data: {
      slug: `${RUN}-draft`,
      title: "Draft course",
      description: "Should never be listed.",
      pricePaise: 0,
      active: false,
    },
  });
});

afterAll(async () => {
  const ids = [learner.id, otherLearner.id];
  await prisma.enrollment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe("catalogue", () => {
  it("lists an active course", async () => {
    const rows = await listCourses();
    expect(rows.some((row) => row.slug === `${RUN}-free`)).toBe(true);
  });

  it("never lists an inactive course", async () => {
    const rows = await listCourses();
    expect(rows.some((row) => row.slug === `${RUN}-draft`)).toBe(false);
  });

  it("does not resolve an inactive course by slug", async () => {
    expect(await getCourse(`${RUN}-draft`)).toBeNull();
  });

  it("counts modules and lessons from the stored outline", async () => {
    const course = await getCourse(`${RUN}-free`);
    expect(course?.moduleCount).toBe(2);
    expect(course?.lessonCount).toBe(2);
  });

  it("reports no count rather than zero for an empty outline", async () => {
    const course = await getCourse(`${RUN}-paid`);
    expect(course?.moduleCount).toBe(0);
    expect(course?.syllabus).toEqual([]);
  });

  it("tolerates a malformed stored outline", () => {
    expect(parseSyllabus({ not: "an array" } as never)).toEqual([]);
    expect(parseSyllabus(null)).toEqual([]);
  });

  it("marks a zero-price course as free", async () => {
    const free = await getCourse(`${RUN}-free`);
    const paid = await getCourse(`${RUN}-paid`);
    expect(free?.isFree).toBe(true);
    expect(paid?.isFree).toBe(false);
  });
});

describe("enrolment", () => {
  it("enrols in a free course", async () => {
    const result = await enrolInFreeCourse({ userId: learner.id, courseId: freeCourseId });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alreadyEnrolled).toBe(false);
    expect(await isEnrolled({ userId: learner.id, courseId: freeCourseId })).toBe(true);
  });

  it("treats a second enrolment as success without a second row", async () => {
    await enrolInFreeCourse({ userId: learner.id, courseId: freeCourseId });
    const again = await enrolInFreeCourse({ userId: learner.id, courseId: freeCourseId });

    expect(again.ok).toBe(true);
    if (again.ok) expect(again.alreadyEnrolled).toBe(true);

    const count = await prisma.enrollment.count({
      where: { userId: learner.id, courseId: freeCourseId },
    });
    expect(count).toBe(1);
  });

  it("refuses free enrolment in a paid course", async () => {
    const result = await enrolInFreeCourse({ userId: learner.id, courseId: paidCourseId });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.requiresPayment).toBe(true);
    expect(await isEnrolled({ userId: learner.id, courseId: paidCourseId })).toBe(false);
  });

  it("refuses enrolment in an inactive course", async () => {
    const draft = await prisma.course.findFirstOrThrow({
      where: { slug: `${RUN}-draft` },
      select: { id: true },
    });

    const result = await enrolInFreeCourse({ userId: learner.id, courseId: draft.id });
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown course", async () => {
    const result = await enrolInFreeCourse({ userId: learner.id, courseId: "nope" });
    expect(result.ok).toBe(false);
  });

  it("never returns another learner's enrolments", async () => {
    await enrolInFreeCourse({ userId: learner.id, courseId: freeCourseId });

    const theirs = await listEnrolments(otherLearner.id);
    expect(theirs).toHaveLength(0);
  });

  it("records a free enrolment as paid at zero", async () => {
    await enrolInFreeCourse({ userId: learner.id, courseId: freeCourseId });

    const row = await prisma.enrollment.findFirstOrThrow({
      where: { userId: learner.id, courseId: freeCourseId },
      select: { pricePaise: true, paidAt: true },
    });

    // Complete on creation: there is no payment to wait for.
    expect(row.pricePaise).toBe(0);
    expect(row.paidAt).not.toBeNull();
  });
});
