import { ContentImage } from "@/components/ui/content-image";
import Link from "next/link";
import { CourseLevel } from "@prisma/client";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import type { CourseCardData } from "@/lib/content/courses";

const LEVEL_LABEL: Record<CourseLevel, string> = {
  [CourseLevel.BEGINNER]: "Beginner",
  [CourseLevel.INTERMEDIATE]: "Intermediate",
  [CourseLevel.ADVANCED]: "Advanced",
};

/**
 * A course in a listing.
 *
 * Module and lesson counts come from the stored outline and are shown only when
 * the outline actually has them - an empty outline reads as no count rather
 * than as zero lessons.
 */
export function CourseCard({ course }: { course: CourseCardData }) {
  return (
    <Card className="group h-full overflow-hidden" variant="interactive">
      <Link
        className="flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        href={`/courses/${course.slug}`}
        prefetch={false}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
          {course.coverImageUrl ? (
            <ContentImage
              alt=""
              className="size-full object-cover transition duration-[var(--motion-normal)] group-hover:scale-105"
              height={360}
              src={course.coverImageUrl}
              width={640}
            />
          ) : (
            <div aria-hidden="true" className="grid size-full place-items-center text-foreground-muted">
              <GraduationCap size={26} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="caption uppercase tracking-wider text-premium">{LEVEL_LABEL[course.level]}</p>
          <h2 className="mt-1.5 heading-sm text-foreground">{course.title}</h2>
          <p className="mt-2 line-clamp-2 body-sm text-foreground-secondary">{course.shortDescription}</p>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 caption text-foreground-muted">
            {course.moduleCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen aria-hidden="true" size={12} />
                {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
                {course.lessonCount > 0 ? ` · ${course.lessonCount} lessons` : ""}
              </span>
            ) : null}
            {course.durationMinutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" size={12} />
                {Math.round(course.durationMinutes / 60)} hours
              </span>
            ) : null}
          </div>

          <p className="mt-auto pt-4 body-md font-semibold text-foreground">
            {course.isFree ? "Free" : formatMoneyMinor(course.pricePaise, course.currency)}
          </p>
        </div>
      </Link>
    </Card>
  );
}
