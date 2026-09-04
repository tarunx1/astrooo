import {
  CalendarDays,
  Gem,
  Heart,
  HeartHandshake,
  Map,
  Moon,
  Orbit,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";

export const quickServices = [
  { title: "Free Kundli", text: "Birth chart from verified inputs", href: "/kundli", icon: Sparkles },
  { title: "Reports", text: "Paid interpretations with status tracking", href: "/reports", icon: ScrollText },
  { title: "Consultations", text: "Call, chat and video sessions", href: "/consultations", icon: HeartHandshake },
  { title: "Gemstones", text: "Certified specs before beliefs", href: "/shop/gemstones", icon: Gem },
  { title: "Panchang", text: "Tithi, nakshatra and muhurat", href: "/panchang", icon: CalendarDays },
  { title: "Ask Astrologer", text: "Focused question flow", href: "/consultations/ask", icon: Heart },
] as const;

export const featuredServices = [
  {
    title: "Complete Life Report",
    type: "Digital Report",
    text: "A structured report covering career, relationships, health themes and timing windows.",
    href: "/reports/complete-life",
    icon: ScrollText,
  },
  {
    title: "Free Kundli Generator",
    type: "Free Tool",
    text: "Capture birth details once and build a reusable profile for future reports.",
    href: "/kundli",
    icon: Orbit,
  },
  {
    title: "Marriage Compatibility",
    type: "Calculator",
    text: "Guna Milan, Manglik markers and relationship considerations in one guided flow.",
    href: "/kundli-matching",
    icon: Heart,
  },
  {
    title: "Muhurat Consultation",
    type: "Consultation",
    text: "Human review for important timing decisions with clear next steps.",
    href: "/consultations/muhurat",
    icon: CalendarDays,
  },
] as const;

export const calculators = [
  { title: "Moon Sign", text: "Understand your emotional pattern.", icon: Moon },
  { title: "Lagna", text: "Find the lens through which life meets you.", icon: Sun },
  { title: "Nakshatra", text: "Know your birth star and its qualities.", icon: Star },
  { title: "Sade Sati", text: "Track Saturn influence with context.", icon: Orbit },
  { title: "Lucky Number", text: "Numerology fixture for name and date.", icon: Sparkles },
] as const;

export const panchangRows = [
  ["Tithi", "Shukla Paksha Dashami"],
  ["Nakshatra", "Rohini"],
  ["Yoga", "Siddhi"],
  ["Rahu Kaal", "10:42 AM - 12:18 PM"],
  ["Abhijit Muhurat", "11:54 AM - 12:46 PM"],
] as const;

export const reports = [
  {
    title: "2026 Year Forecast",
    text: "A month-by-month view for major decisions.",
    price: "₹799",
    tone: "chart",
    image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Career & Finance",
    text: "Work, wealth and growth timing.",
    price: "₹599",
    tone: "mountain",
    image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Love & Marriage",
    text: "Patterns, compatibility and remedies.",
    price: "₹599",
    tone: "heart",
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Health & Wellbeing",
    text: "Traditional indicators and caution windows.",
    price: "₹599",
    tone: "tree",
    image: "https://images.unsplash.com/photo-1507499739999-097706ad8914?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Dasha Predictions",
    text: "Planetary periods explained clearly.",
    price: "₹699",
    tone: "planet",
    image: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=600&auto=format&fit=crop&q=80",
  },
] as const;

export const storeCategories = [
  {
    title: "Gemstones",
    text: "Certified origin, treatment and lab details.",
    href: "/shop/gemstones",
    icon: Gem,
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Rudraksha",
    text: "Traditional associations explained responsibly.",
    href: "/shop/rudraksha",
    icon: ShieldCheck,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Yantras",
    text: "Sacred geometry pieces for home and puja.",
    href: "/shop/yantras",
    icon: Map,
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80",
  },
] as const;

export const astrologers = [
  {
    name: "Acharya Dev Raman",
    skill: "Career, business, dasha",
    language: "Hindi, English",
    sessions: "12k+",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
  },
  {
    name: "Dr. Kavya Trivedi",
    skill: "Marriage, compatibility",
    language: "Hindi, Gujarati",
    sessions: "8k+",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80",
  },
  {
    name: "Pandit Neel Sharma",
    skill: "Muhurat, remedies",
    language: "Hindi, Sanskrit",
    sessions: "15k+",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
  },
] as const;

export const trustMetrics = [
  { value: "250k+", label: "Birth profiles created" },
  { value: "42k+", label: "Reports delivered" },
  { value: "4.8/5", label: "Average consultation rating" },
  { value: "100%", label: "Secure payment abstraction" },
] as const;

export const articles = [
  { title: "How to read your first Kundli without getting overwhelmed", category: "Guide" },
  { title: "What gemstone certificates prove, and what they do not", category: "Commerce" },
  { title: "Panchang basics for planning ordinary work days", category: "Panchang" },
] as const;
