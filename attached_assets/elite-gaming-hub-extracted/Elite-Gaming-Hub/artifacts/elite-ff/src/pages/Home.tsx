import { useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Zap, Shield, Headphones, MessageSquare, Instagram, Mail, X } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import logoImg from "@assets/Elite_1777629983897.png";


const WHY = [
  { icon: Zap, title: "Easy Registration", desc: "Sign up and join any tournament in seconds" },
  { icon: Shield, title: "Anti-Cheat Verified", desc: "Anti-cheat verified, host-monitored matches" },
  { icon: Headphones, title: "Email Support", desc: "Typical response time: within a few hours" },
  { icon: Trophy, title: "Registration Open 24/7", desc: "Get tournament updates instantly" },
];

export default function Home() {
  const [, navigate] = useLocation();
  const { appName, logoUrl } = useAppContext();
  const [contactOpen, setContactOpen] = useState(false);
  const [whatsappUrl] = useState(() => localStorage.getItem("eliteff_whatsapp_url") || "https://wa.me/");
  const [instagramUrl] = useState(() => localStorage.getItem("eliteff_instagram_url") || "https://instagram.com/");

  return (
    <div className="flex flex-col gap-6 pb-6" data-testid="home-page">
      {/* Hero */}
      <div
        className="relative rounded-2xl overflow-hidden mx-4 mt-2"
        style={{ background: "var(--th-card)" }}
      >
        {/* BG glow */}
        <div className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(255,107,53,0.4) 0%, transparent 60%)" }}
        />
        <div
          className="absolute top-6 right-10 w-40 h-40 rounded-full pointer-events-none opacity-20"
          style={{ background: "radial-gradient(circle, rgba(255,107,53,0.6) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 p-6 md:p-8 flex flex-col gap-6">
          {/* Logo + name row */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg">
              <img src={logoImg} alt="logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div
                className="font-display font-black text-xs uppercase tracking-widest"
                style={{ color: "var(--th-muted)" }}
              >
                Free Fire Tournaments
              </div>
              <div className="font-display font-black text-xl text-foreground leading-none">
                <span style={{ color: "#ff6b35" }}>{appName.split(" ")[0]}</span>
                {appName.includes(" ") && <span> {appName.split(" ").slice(1).join(" ")}</span>}
              </div>
            </div>
          </div>

          {/* Heading */}
          <div>
            <h1
              className="font-display font-black leading-none mb-3"
              style={{ fontSize: "clamp(2.6rem, 8vw, 4.5rem)", color: "var(--th-text)" }}
            >
              Dominant<br />
              <span style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff2d00 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Battleground
              </span>
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--th-muted)", maxWidth: "24rem" }}>
              Compete in elite Free Fire tournaments. Prove you're the last one standing and claim your prize.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/tournaments")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-smooth active:scale-95 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)", color: "#fff" }}
                data-testid="home.find_matches.primary_button"
              >
                <Trophy size={16} /> Find Matches
              </button>
              <button
                onClick={() => navigate("/results")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-smooth active:scale-95 hover:scale-105"
                style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.3)" }}
                data-testid="home.results.secondary_button"
              >
                Results
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Why Elite FF */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ff6b35" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span className="font-display font-black text-xl text-foreground">Why Elite FF?</span>
        </div>
        <div className="flex flex-col gap-3">
          {WHY.map((w, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 flex items-center gap-4 transition-smooth"
              style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,107,53,0.12)" }}
              >
                <w.icon size={20} style={{ color: "#ff6b35" }} />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{w.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>{w.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community */}
      <div className="px-4">
        <div className="font-display font-black text-xl text-foreground mb-1">Join Our Community</div>
        <p className="text-sm mb-4" style={{ color: "var(--th-muted)" }}>
          Dedicated host assistance around the clock
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl p-4 transition-smooth"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            data-testid="home.whatsapp.link"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
              <MessageSquare size={18} style={{ color: "#22c55e" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">WhatsApp Us</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>Join WhatsApp Group</div>
            </div>
            <div className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              Chat
            </div>
          </a>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl p-4 transition-smooth"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            data-testid="home.instagram.link"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,53,0.12)" }}>
              <Instagram size={18} style={{ color: "#ff6b35" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">Follow on Instagram</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>Stay updated</div>
            </div>
            <div className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}>
              Follow
            </div>
          </a>
          <button
            onClick={() => setContactOpen(true)}
            className="flex items-center gap-4 rounded-2xl p-4 transition-smooth w-full text-left"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            data-testid="home.contact_us.button"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.12)" }}>
              <Mail size={18} style={{ color: "#818cf8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">Contact Us</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>Email Support</div>
            </div>
            <div className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
              Email
            </div>
          </button>
        </div>
      </div>

      <p className="text-center text-xs pb-2" style={{ color: "var(--th-dimmer)" }}>
        © Elite FF Tournaments
      </p>

      {/* Contact dialog */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setContactOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            onClick={e => e.stopPropagation()}
            data-testid="home.contact_modal.dialog"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-xl text-foreground">Contact Us</h3>
              <button
                onClick={() => setContactOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-smooth"
                style={{ color: "var(--th-muted)" }}
                data-testid="home.contact_modal.close_button"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>
              Have a question or need help? Reach us directly:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-smooth active:scale-95"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                data-testid="home.contact_modal.whatsapp.link"
              >
                <MessageSquare size={16} /> WhatsApp Us
              </a>
              <a
                href="mailto:eliteff@gmail.com"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-smooth active:scale-95"
                style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
                data-testid="home.contact_modal.gmail.link"
              >
                <Mail size={16} /> Send Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
