import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { SmoothInput } from "@/components/ui/smooth-input";
import { listArticles } from "@/lib/content/articles";
import { CelestialArt } from "@/components/home/celestial-art";
import styles from "@/components/home/home-experience.module.css";
export async function InsightsSection() {
  const result=await listArticles({pageSize:3}).catch(()=>null);
  return <Section id="learn"><SectionHeader title="Notes from the observatory" text="A quiet place to learn. Read the ideas, traditions and practical details behind your next discovery."/>
    <div className={styles.journal}><div>{result?.rows.map((article,i)=><Link href={`/articles/${article.slug}`} className={styles.guide} key={article.id}><span className="caption text-foreground-muted">0{i+1}</span><span><span className={styles.eyebrow}>{article.categoryName??"Guide"}</span><h3>{article.title}</h3><span className="caption text-foreground-muted block mt-3">{article.readingMinutes} min read</span></span><CelestialArt kind={/gem|certif/i.test(article.title)?"gem":/panchang|moon/i.test(article.title)?"clock":"chart"}/></Link>)}{!result?.rows.length&&<p className={styles.empty}>New guides are being prepared. Explore the knowledge archive for published articles.</p>}<Button className="mt-6" href="/articles" variant="text">Visit the knowledge archive <ArrowRight size={16}/></Button></div>
      <div className={`${styles.panel} ${styles.transmission}`}><Sparkles className="mx-auto text-premium mb-6" size={28}/><p className={styles.eyebrow}>Celestial notes</p><h2 className="heading-xl mt-4">A little perspective,<br/>delivered quietly.</h2><p className="body-sm text-foreground-secondary mt-4">Panchang, reports and guides from the observatory.</p><label className="block mt-7 text-left"><span className="caption text-foreground-muted">Email address</span><SmoothInput type="email" autoComplete="email" aria-describedby="newsletter-status" className="form-control mt-2" placeholder="you@example.com"/></label><Button className="w-full mt-3" variant="secondary" disabled>Subscriptions opening soon</Button><p id="newsletter-status" className="caption text-foreground-muted mt-4">Signup is not open yet. No email addresses are collected here.</p></div>
    </div>
  </Section>;
}
