import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { featuredServices } from "@/data/home";
import { CelestialArt, type CelestialArtKind } from "@/components/home/celestial-art";
import styles from "@/components/home/home-experience.module.css";
const scenes: CelestialArtKind[] = ["timeline", "chart", "matching", "clock"];
export function ServicesSection() {
  return <Section id="services"><SectionHeader title="Your personal observatory" text="Begin with your birth chart. Explore the questions, relationships and moments that matter to you." />
    <div className={styles.services}>{featuredServices.map((service,index)=><Card key={service.title} spotlight className={`${styles.panel} ${styles.service}`}><Link className={styles.serviceLink} href={service.href}>
      <div className={styles.serviceMeta}><span>{service.type}</span><span>0{index+1}</span></div>
      <div className={styles.serviceArt}><CelestialArt kind={scenes[index]}/></div>
      <div><h3>{service.title}</h3><p>{service.text}</p></div>
      <span className={styles.serviceArrow}>Explore <ArrowRight size={16}/></span>
    </Link></Card>)}</div>
  </Section>;
}
