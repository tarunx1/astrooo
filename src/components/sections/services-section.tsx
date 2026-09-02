import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { featuredServices } from "@/data/home";

export function ServicesSection() {
  return (
    <Section className="pt-16" id="services">
      <SectionHeader
        title="A platform, not a landing page"
        text="The homepage is structured around real service discovery: free tools, paid reports, consultations, puja and commerce can grow without becoming a maze."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {featuredServices.map((service, index) => {
          const Icon = service.icon;
          return (
            <a
              className="group border border-border bg-surface p-6 shadow-[var(--shadow-md)] transition hover:-translate-y-1 hover:border-primary/70"
              href={service.href}
              key={service.title}
            >
              <div className="flex items-start justify-between gap-4">
                <Icon className="text-premium" size={26} />
                <span className="caption text-foreground-muted">0{index + 1}</span>
              </div>
              <p className="mt-7 caption uppercase text-premium">{service.type}</p>
              <h3 className="mt-3 heading-lg">{service.title}</h3>
              <p className="mt-4 body-sm text-foreground-secondary">{service.text}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition group-hover:text-premium">
                Open service <ArrowRight size={16} />
              </span>
            </a>
          );
        })}
      </div>
    </Section>
  );
}
