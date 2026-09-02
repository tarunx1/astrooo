import { MessageCircle, Phone, Video } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { astrologers } from "@/data/home";

export function ConsultationSection() {
  return (
    <Section className="bg-background-subtle" id="consultations">
      <SectionHeader
        action={<Button href="/consultations" variant="secondary">Book Consultation</Button>}
        title="Consult verified astrologers"
        text="The consultation surface is designed for service discovery first: expertise, language, mode, availability and transparent pricing can all become sortable attributes."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {astrologers.map((astrologer) => (
          <article className="border border-border bg-surface p-6" key={astrologer.name}>
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-16 place-items-center rounded-full border border-premium/60 bg-background font-display text-2xl text-premium">
                {astrologer.name.split(" ").at(-1)?.charAt(0)}
              </div>
              <span className="caption text-success">Online</span>
            </div>
            <h3 className="mt-5 heading-lg">{astrologer.name}</h3>
            <p className="mt-2 body-sm text-foreground-secondary">{astrologer.skill}</p>
            <p className="mt-1 body-sm text-foreground-muted">{astrologer.language} · {astrologer.sessions} sessions</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[Phone, MessageCircle, Video].map((Icon, index) => (
                <button className="grid min-h-11 place-items-center rounded-md border border-border bg-background text-premium transition hover:border-premium" key={index} type="button">
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
