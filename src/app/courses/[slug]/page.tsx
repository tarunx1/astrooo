import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, GraduationCap, User } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { EnrolButton } from "@/components/content/enrol-button";
import { COURSE_LEVEL_LABEL, getCourse, isEnrolled } from "@/lib/content/courses";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { brand } from "@/config/brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);

  if (!course) return { title: "Course not found", robots: { index: false, follow: false } };

  return {
    title: `${course.title} | Astrology Courses`,
    description: course.shortDescription.slice(0, 200),
    alternates: { canonical: `${brand.url}/courses/${course.slug}` },
  };
}

/**
 * One course.
 *
 * The syllabus is shown as an outline of what is covered. No progress is
 * displayed, because there is no lesson delivery to measure it against - a
 * completion bar here would be a number nobody computed.
 */
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [course, user] = await Promise.all([getCourse(slug), getCurrentUser()]);

  if (!course) notFound();

  const enrolled = user ? await isEnrolled({ userId: user.id, courseId: course.id }) : false;

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link className="caption text-foreground-muted underline transition hover:text-foreground" href="/courses">
            ← All courses
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-8">
            <header>
              <p className="caption uppercase tracking-wider text-premium">
                {COURSE_LEVEL_LABEL[course.level]}
              </p>
              <h1 className="mt-2 heading-xl">{course.title}</h1>
              <p className="mt-3 body-lg text-foreground-secondary">{course.shortDescription}</p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 body-sm text-foreground-muted">
                {course.instructorName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <User aria-hidden="true" size={14} />
                    {course.instructorName}
                  </span>
                ) : null}
                {course.durationMinutes ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden="true" size={14} />
                    {Math.round(course.durationMinutes / 60)} hours
                  </span>
                ) : null}
                {course.moduleCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap aria-hidden="true" size={14} />
                    {course.moduleCount} modules
                  </span>
                ) : null}
              </div>
            </header>

            {course.coverImageUrl ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <Image
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                  height={720}
                  priority
                  src={course.coverImageUrl}
                  width={1280}
                />
              </div>
            ) : null}

            <section aria-labelledby="about-heading">
              <h2 className="heading-md" id="about-heading">
                About this course
              </h2>
              <p className="mt-3 whitespace-pre-wrap body-md text-foreground-secondary">
                {course.description}
              </p>
            </section>

            {course.syllabus.length > 0 ? (
              <section aria-labelledby="syllabus-heading">
                <h2 className="heading-md" id="syllabus-heading">
                  What is covered
                </h2>
                <ol className="mt-4 grid gap-3">
                  {course.syllabus.map((module, index) => (
                    <li className="rounded-lg border border-border bg-surface p-5" key={module.title}>
                      <p className="body-sm font-semibold text-foreground">
                        {index + 1}. {module.title}
                      </p>
                      {module.summary ? (
                        <p className="mt-1.5 body-sm text-foreground-secondary">{module.summary}</p>
                      ) : null}
                      {module.lessons && module.lessons.length > 0 ? (
                        <ul className="mt-3 grid gap-1.5">
                          {module.lessons.map((lesson) => (
                            <li className="caption text-foreground-muted" key={lesson}>
                              · {lesson}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-border bg-surface p-6">
              <p className="heading-md text-foreground">
                {course.isFree ? "Free" : formatMoneyMinor(course.pricePaise, course.currency)}
              </p>
              <div className="mt-5">
                <EnrolButton courseId={course.id} enrolled={enrolled} isFree={course.isFree} />
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>
    </Section>
  );
}
