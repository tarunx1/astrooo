import type { Metadata } from "next";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { CourseCard } from "@/components/content/course-card";
import { listCourses } from "@/lib/content/courses";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Learn Vedic Astrology | Courses",
  description:
    "Structured courses in Vedic and KP astrology, from first principles to chart reading, taught without mystification.",
  alternates: { canonical: `${brand.url}/courses` },
};

/** The course catalogue. Only active courses are queried. */
export default async function CoursesPage() {
  const courses = await listCourses();

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Structured learning in Vedic and KP astrology, built on the same calculations this site runs on."
          title="Courses"
        />

        {courses.length === 0 ? (
          <EmptyState
            message="Our courses are being prepared. Please check back shortly."
            title="No courses published yet"
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <li className="h-full" key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </Section>
  );
}
