"use client";
import { useEffect, useState } from "react";
import type { HomePanchang } from "@/lib/astrology/home-panchang";
import styles from "./home-experience.module.css";
export function AlmanacClock({ value }: { value: HomePanchang | null }) {
  const [clock,setClock]=useState<{time:string;hour:number;minute:number}|null>(null);
  useEffect(()=>{
    if(!value) return;
    const update=()=>{const now=new Date();const parts=new Intl.DateTimeFormat("en-GB",{timeZone:value.location.timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);const hour=Number(parts.find(p=>p.type==="hour")?.value??0);const minute=Number(parts.find(p=>p.type==="minute")?.value??0);setClock({time:parts.map(p=>p.value).join(""),hour,minute});};
    update();const id=setInterval(update,60000);return()=>clearInterval(id);
  },[value]);
  return <div className={styles.clock}><svg viewBox="0 0 240 240" aria-hidden="true" className={styles.art} fill="none"><circle cx="120" cy="120" r="96"/><circle cx="120" cy="120" r="88" className={styles.artFaint}/>{Array.from({length:60},(_,i)=><path key={i} d={`M120 29V${i%5===0?37:32}`} transform={`rotate(${i*6} 120 120)`}/>)}{clock&&<><path d="M120 120V65" transform={`rotate(${clock.hour*30+clock.minute*.5} 120 120)`}/><path d="M120 120V45" transform={`rotate(${clock.minute*6} 120 120)`}/></>}<circle cx="120" cy="120" r="3" className={styles.artPoint}/></svg><p className={styles.eyebrow}>{value?.location.city??"Daily almanac"}</p>{clock&&<p className="text-2xl mt-2 tabular-nums">{clock.time}</p>}{value&&<time dateTime={value.date}>{new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(`${value.date}T12:00:00Z`))}</time>}{value?.phase&&<p className="body-sm mt-3 text-premium">{value.phase}</p>}{(value?.sunrise||value?.sunset)&&<div className="flex justify-center gap-6 mt-4 caption text-foreground-secondary">{value.sunrise&&<span>Sunrise<br/>{value.sunrise}</span>}{value.sunset&&<span>Sunset<br/>{value.sunset}</span>}</div>}</div>;
}
