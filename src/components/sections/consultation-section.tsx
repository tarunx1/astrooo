import Link from "next/link";
import { ArrowRight, MessageCircle, Phone, Video } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentImage } from "@/components/ui/content-image";
import { listDirectory } from "@/lib/consultations/directory";
import { RatingDisplay } from "@/components/consultations/pandit-card";
import { CelestialArt } from "@/components/home/celestial-art";
import styles from "@/components/home/home-experience.module.css";
const modes={CHAT:{label:"Chat",Icon:MessageCircle},VOICE_CALL:{label:"Call",Icon:Phone},VIDEO_CALL:{label:"Video",Icon:Video}};
export async function ConsultationSection() {
  const result=await listDirectory({pageSize:3}).catch(()=>null);
  return <Section id="consultations"><div className={styles.networkHeader}><SectionHeader title="A human perspective" text="Meet verified practitioners. Find the expertise, language and consultation format that feels right for you." action={<Button href="/consultations" variant="text">Meet the astrologers <ArrowRight size={16}/></Button>}/><CelestialArt kind="network"/></div>
    <div className={styles.portraits}>{result?.rows.map(person=><Card spotlight key={person.id} className={`${styles.panel} ${styles.portrait}`}><Link href={`/consultations/${person.slug}`}><div className={styles.portraitImage}>{person.profileImageUrl?<ContentImage src={person.profileImageUrl} alt={person.displayName} width={600} height={650}/>:<span>{person.displayName.slice(0,1)}</span>}</div><div className={styles.reportBody}><p className={styles.eyebrow}>{person.verified?"Verified practitioner":"Practitioner"}</p><h3 className="heading-lg mt-3">{person.displayName}</h3><p className="body-sm mt-2 text-foreground-secondary">{person.expertise.join(" · ")}</p><p className="caption mt-2 mb-3 text-foreground-muted">{person.languages.join(" · ")}</p><RatingDisplay rating={person.rating} reviewCount={person.reviewCount}/><p className="caption mt-3 text-foreground-secondary">{person.hasAvailability?"Appointment windows available":"Check appointment availability"}</p></div></Link><div className={`${styles.modes} px-6 pb-6`}>{person.services.map(service=>{const {Icon,label}=modes[service.mode];return <Link key={service.mode} href={`/consultations/${person.slug}`} aria-label={`${label} with ${person.displayName}`}><Icon size={15}/>{label}</Link>;})}</div></Card>)}</div>
    {!result?.rows.length&&<div className={styles.empty}><p>Explore the practitioner directory for current profiles and appointment availability.</p><Button className="mt-5" href="/consultations" variant="secondary">Browse practitioners</Button></div>}
  </Section>;
}
