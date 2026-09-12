import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ResponsiveGrid, Section, SectionHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { featuredServices } from "@/data/home";

export function ServicesSection() {
  return (
    <Section className="pt-16" id="services">
      <SectionHeader
        title="A platform, not a landing page"
        text="The homepage is structured around real service discovery: free tools, paid reports, consultations, puja and commerce can grow without becoming a maze."
      />
      <ResponsiveGrid min="15.5rem">
        {featuredServices.map((service, index) => {
          const Icon = service.icon;
          return (
            <Card
              equalHeight
              spotlight
              variant="glass"
              className="group overflow-hidden"
              key={service.title}
            >
              <Link
                className="flex h-full flex-col p-5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
                href={service.href}
                prefetch={false}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-11 place-items-center rounded-lg border border-border bg-surface-raised text-premium">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <span className="caption text-foreground-muted">0{index + 1}</span>
                </div>
                <CardBody className="mt-6 gap-3">
                  <Badge variant="premium">{service.type}</Badge>
                  <h3 className="heading-md">{service.title}</h3>
                  <p className="body-sm text-foreground-secondary">{service.text}</p>
                </CardBody>
                <CardFooter>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-premium transition group-hover:text-foreground">
                    Open service <ArrowRight size={16} />
                  </span>
                </CardFooter>
              </Link>
            </Card>
          );
        })}
      </ResponsiveGrid>
    </Section>
  );
}
