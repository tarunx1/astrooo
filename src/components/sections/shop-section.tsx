import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentImage } from "@/components/ui/content-image";
import { listProducts } from "@/lib/shop/catalog";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { CelestialArt } from "@/components/home/celestial-art";
import styles from "@/components/home/home-experience.module.css";
export async function ShopSection() {
  const products=await listProducts({categorySlug:"gemstones",limit:3}).catch(()=>[]);
  return <Section id="shop"><SectionHeader title="The gemstone vault" text="Discover the material, the craftsmanship and the details behind each piece." action={<Button href="/shop" variant="text">Visit the collection <ArrowRight size={16}/></Button>}/>
    <div className={styles.specimens}>{products.map(product=><Card spotlight key={product.id} className={`${styles.panel} ${styles.specimen}`}><Link href={`/product/${product.slug}`}><div className={styles.specimenImage}>{product.imageUrl?<ContentImage src={product.imageUrl} alt={product.imageAlt} width={600} height={600}/>:<CelestialArt kind="gem"/>}</div><div className={styles.reportBody}><p className={styles.eyebrow}>{product.categoryName??"The collection"}</p><h3 className="heading-lg mt-3">{product.title}</h3><p className="mt-3">{formatMoneyMinor(product.priceMinor,product.currency)}</p>{product.certified&&<span className={styles.certified}><BadgeCheck size={15}/> Certificate details available</span>}<span className={styles.reportExplore}>View piece <ArrowRight size={15}/></span></div></Link></Card>)}</div>
    {!products.length&&<p className={styles.empty}>New pieces are being prepared for the collection. Browse the shop for current availability.</p>}
    <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 caption text-foreground-secondary"><span>Origin & treatment details</span><span>Certificates where supplied</span><span>Care information</span><span>Clear product specifications</span></div>
  </Section>;
}
