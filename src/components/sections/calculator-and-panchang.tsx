import Link from "next/link";
import { ArrowRight, LockKeyhole, MapPin } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm } from "@/components/kundli/birth-details-form";
import { AlmanacClock } from "@/components/home/almanac-clock";
import { BirthRitual } from "@/components/home/birth-ritual";
import { CelestialArt } from "@/components/home/celestial-art";
import { ASTROLOGY_TOOLS } from "@/config/calculators";
import { getHomePanchang } from "@/lib/astrology/home-panchang";
import styles from "@/components/home/home-experience.module.css";
const capsules = [{slug:"moon-sign",motion:"moon"},{slug:"lagna",motion:"rotate"},{slug:"nakshatra",motion:"pulse"},{slug:"sade-sati",motion:"orbit"},{slug:"numerology",motion:"digits"}];
export async function CalculatorAndPanchang() {
  const panchang = await getHomePanchang();
  return <Section id="observatory">
    <SectionHeader title="A chart as individual as you" text="Your date, time and place of birth are the starting point. Enter them once to create your free Kundli."/>
    <div className={styles.lab}>
      <div className={`${styles.panel} ${styles.formPanel}`}><p className={styles.eyebrow}>The Kundli observatory</p><h2 className="heading-lg mt-3 mb-5">Generate your free Kundli</h2><BirthDetailsForm compact decoration={<BirthRitual/>}/><p className="mt-4 caption text-foreground-muted flex items-center gap-2"><LockKeyhole size={14}/> Your birth details stay private.</p></div>
      <div><div className="h-44"><CelestialArt kind="chart"/></div><p className={styles.eyebrow}>Small tools. Personal discoveries.</p><h2 className="heading-lg mt-3">Free calculators</h2><div className={styles.capsules}>{capsules.map(({slug,motion})=>{const tool=ASTROLOGY_TOOLS.find(item=>item.slug===slug)!;const Icon=tool.icon;return <Link key={slug} href={tool.href} className={styles.capsule} data-motion={motion}><Icon className={styles.capsuleIcon}/><span className="flex-1"><strong>{tool.title.replace(" Calculator","")}</strong><small>{tool.shortDescription}</small><span className={`block ${styles.capsuleLine}`}/></span><ArrowRight size={16} className="text-premium"/></Link>;})}</div></div>
    </div>
    <div id="daily-panchang" className={`${styles.panel} ${styles.almanac}`}>
      <AlmanacClock value={panchang}/>
      <div><p className="caption text-foreground-muted flex items-center gap-2"><MapPin size={14}/>{panchang?.location.city??"New Delhi"}</p><h2 className="heading-lg mt-3">Today&apos;s Panchang</h2><div className={styles.rows}>{panchang ? panchang.rows.map(([label,value])=><div key={label}><span className="text-foreground-muted">{label}</span><strong>{value}</strong></div>):<p className="py-5 text-foreground-secondary">Today&apos;s values are temporarily unavailable. Choose a date and place in the full Panchang.</p>}</div><Button className="mt-6" href="/panchang" variant="secondary">Explore Panchang <ArrowRight size={16}/></Button></div>
    </div>
  </Section>;
}
