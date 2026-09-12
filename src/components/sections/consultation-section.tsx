import Image from "next/image";
import { MessageCircle, Phone, Video } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { astrologers } from "@/data/home";

export function ConsultationSection() {
  return (
    <Section id="consultations">
      <SectionHeader
        action={<Button href="/consultations" variant="secondary">Book Consultation</Button>}
        title="Consult verified astrologers"
        text="The consultation surface is designed for service discovery first: expertise, language, mode, availability and transparent pricing can all become sortable attributes."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {astrologers.map((astrologer) => (
          <Card equalHeight padding="lg" variant="glass" spotlight={true} key={astrologer.name}>
            <div className="flex items-start justify-between gap-4">
              <div className="relative size-16 overflow-hidden rounded-full border border-premium/70 shadow-md">
                <Image
                  src={astrologer.avatar}
                  alt={astrologer.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <Badge variant="success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Online
              </Badge>
            </div>
            <CardBody className="mt-5 gap-2">
              <h3 className="heading-md">{astrologer.name}</h3>
              <p className="body-sm text-foreground-secondary">{astrologer.skill}</p>
              <p className="body-sm text-foreground-muted">{astrologer.language} · {astrologer.sessions} sessions</p>
            </CardBody>
            <CardFooter className="grid grid-cols-3 gap-2">
              {[
                { Icon: Phone, label: "Call" },
                { Icon: MessageCircle, label: "Chat with" },
                { Icon: Video, label: "Video call" },
              ].map(({ Icon, label }) => (
                <button
                  aria-label={`${label} ${astrologer.name}`}
                  className="grid min-h-11 place-items-center rounded-md border border-white/10 bg-background/60 text-premium transition hover:border-premium hover:bg-background"
                  key={label}
                  type="button"
                >
                  <Icon aria-hidden="true" size={18} />
                </button>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </Section>
  );
}
