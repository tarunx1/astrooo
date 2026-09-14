import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listActiveReportDefinitions, formatMoneyMinor } from "@/lib/reports/catalog";
import { CelestialArt, type CelestialArtKind } from "@/components/home/celestial-art";
import styles from "@/components/home/home-experience.module.css";
function reportArt(name:string):CelestialArtKind { if (/complete|dasha/i.test(name)) return "timeline"; if (/career|finance/i.test(name)) return "career"; if (/love|marriage|compatib/i.test(name)) return "matching"; if (/health|well/i.test(name)) return "balance"; if (/dasha/i.test(name)) return "timeline"; return "clock"; }
export async function ReportsSection() {
  const catalogue = await listActiveReportDefinitions().catch(()=>[]);
  const featuredSlugs = ["year-forecast", "career", "love-marriage", "finance", "complete-life", "health", "dasha"];
  const reports = featuredSlugs.flatMap(slug => catalogue.filter(report => report.slug === slug));
  return <Section id="reports"><SectionHeader title="The report library" text="Thoughtful perspectives on your year, your relationships and the chapters ahead." action={<Button href="/reports" variant="text">All reports <ArrowRight size={16}/></Button>}/>
    <div className={styles.reports}>{reports.slice(0,6).map(report=><Card spotlight key={report.id} className={`${styles.panel} ${styles.report}`}><Link href={`/reports/${report.slug}`}><div className={styles.reportArt}><CelestialArt kind={reportArt(report.name)}/></div><div className={styles.reportBody}><p className={styles.eyebrow}>Personal astrology</p><h3>{report.name}</h3><p className="body-sm text-foreground-secondary">{report.shortDescription}</p><p className="mt-4 font-semibold">{formatMoneyMinor(report.priceMinor,report.currency)}</p><span className={styles.reportExplore}>Explore report <ArrowRight size={15}/></span></div></Link></Card>)}</div>
    {!reports.length&&<p className={styles.empty}>The report library is being updated. Please check the catalogue for available reports.</p>}
    <div className={styles.matching}><CelestialArt kind="matching"/><div><p className={styles.eyebrow}>Two charts. One conversation.</p><h2 className="heading-xl mt-4">The compatibility chamber</h2><p className="body text-foreground-secondary mt-4">Explore Ashtakoota compatibility with both birth profiles. Your matching score appears only after calculation.</p><Button className="mt-6" href="/kundli-matching" variant="premium">Compare your charts <ArrowRight size={16}/></Button></div></div>
  </Section>;
}
