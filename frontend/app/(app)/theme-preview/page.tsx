'use client';

// ── Combined palette ────────────────────────────────────────────
// Structure from palette 1:
//   rich black  #061414  → background
//   laurel leaf #96998c  → muted text
//   celeste     #d2d3ce  → borders / subtle fills
//   ceiling wht #e9ebe6  → primary text
//
// Accents pulled from the fitness app vibe (image 2):
//   soft mint   #7dd4c0  → primary accent (replaces neon)
//   warm amber  #d4a96a  → secondary accent / rings
//   dusty coral #c47f6a  → tertiary card gradient

const C = {
  bg:       '#061414',
  card:     '#0b1a19',
  cardAlt:  '#0e1f1e',
  mint:     '#7dd4c0',   // soft teal — primary accent
  amber:    '#d4a96a',   // warm gold — secondary
  coral:    '#c47f6a',   // dusty coral — tertiary
  text:     '#e9ebe6',   // ceiling white
  muted:    '#96998c',   // laurel leaf
  celeste:  '#d2d3ce',
  border:   'rgba(210,211,206,0.09)',
  borderMd: 'rgba(210,211,206,0.16)',
};

// Arc ring stat card
const StatCard = ({
  icon, value, label, pct, ringColor,
}: { icon: string; value: string; label: string; pct: number; ringColor: string }) => {
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div style={{ flex: 1, background: C.card, borderRadius: 22, padding: '18px 14px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(210,211,206,0.08)" strokeWidth="3.5" />
          <circle cx="26" cy="26" r={r} fill="none" stroke={ringColor} strokeWidth="3.5"
            strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '26px 26px' }} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>{value}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
};

// Meal / workout-style hero card
const MealCard = ({
  day, title, sub, cal, time, tags, gradientFrom, gradientTo,
}: {
  day: string; title: string; sub: string; cal: string; time: string;
  tags: string[]; gradientFrom: string; gradientTo: string;
}) => (
  <div style={{ borderRadius: 26, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`, minHeight: 164 }}>
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, rgba(6,20,20,0.5) 0%, rgba(6,20,20,0.05) 100%)' }} />
    <div style={{ position: 'relative', padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 164 }}>
      <div>
        {/* Day pill */}
        <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)' }}>{day}</span>
        <p style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{sub}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}>{t}</span>
        ))}
        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(125,212,192,0.22)', color: C.mint, border: `1px solid rgba(125,212,192,0.35)` }}>⚡ {cal}</span>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.14)', color: '#fff' }}>⏱ {time}</span>
      </div>
    </div>
  </div>
);

// Compact recipe row
const RecipeRow = ({ title, cat, kcal, dot }: { title: string; cat: string; kcal: number; dot: string }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div>
        <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{title}</p>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 1, textTransform: 'capitalize' }}>{cat}</p>
      </div>
    </div>
    <span style={{ fontSize: 13, fontWeight: 700, color: C.mint, background: 'rgba(125,212,192,0.1)', padding: '4px 10px', borderRadius: 10, flexShrink: 0 }}>{kcal} cal</span>
  </div>
);

// Section header
const SectionHead = ({ label, link }: { label: string; link: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{label}</h2>
    <span style={{ fontSize: 13, fontWeight: 600, color: C.mint, cursor: 'pointer' }}>{link} →</span>
  </div>
);

export default function ThemePreview() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 32px 100px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Top header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Welcome back,</p>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: C.text, letterSpacing: '-0.8px', marginTop: 2 }}>Your Dashboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: C.card, border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: C.muted, cursor: 'pointer' }}>🔍</div>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: C.bg, fontWeight: 900, cursor: 'pointer' }}>+</div>
          </div>
        </div>

        {/* ── Stat rings ── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHead label="Today" link="Activity" />
          <div style={{ display: 'flex', gap: 12 }}>
            <StatCard icon="🥗" value="1,840" label="calories"      pct={0.62} ringColor={C.amber} />
            <StatCard icon="💧" value="6 cups" label="water"        pct={0.75} ringColor={C.mint}  />
            <StatCard icon="⚡" value="4 / 5"  label="meals planned" pct={0.80} ringColor={C.coral} />
          </div>
        </div>

        {/* ── Meal plan cards ── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHead label="Meal Plan" link="View all" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MealCard
              day="Monday"
              title="Grilled Salmon & Quinoa"
              sub="High protein · Mediterranean"
              cal="520 kcal"
              time="35 min"
              tags={['Dinner', '4 servings']}
              gradientFrom="#1a3830"
              gradientTo="#0d2420"
            />
            <MealCard
              day="Tuesday"
              title="Avocado Chicken Bowl"
              sub="Clean eating · Low carb"
              cal="440 kcal"
              time="20 min"
              tags={['Lunch', '2 servings']}
              gradientFrom="#2e1f10"
              gradientTo="#1c1208"
            />
          </div>
        </div>

        {/* ── Saved recipes ── */}
        <div style={{ marginBottom: 36 }}>
          <SectionHead label="Saved Recipes" link="All recipes" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RecipeRow title="Pasta Carbonara"     cat="dinner"    kcal={680} dot={C.amber} />
            <RecipeRow title="Greek Yogurt Parfait" cat="breakfast" kcal={320} dot={C.mint}  />
            <RecipeRow title="Lentil Soup"          cat="lunch"     kcal={410} dot={C.coral} />
          </div>
        </div>

        {/* ── AI CTA banner ── */}
        <div style={{ background: C.cardAlt, borderRadius: 26, padding: '28px 28px', border: `1px solid ${C.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.mint, textTransform: 'uppercase', letterSpacing: 1 }}>AI Powered</p>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 6, letterSpacing: '-0.4px' }}>Generate this week's meal plan</h3>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Based on your pantry, goals & preferences</p>
          </div>
          <button style={{ flexShrink: 0, height: 48, padding: '0 26px', borderRadius: 14, background: C.mint, border: 'none', color: C.bg, fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: '-0.2px' }}>
            Generate →
          </button>
        </div>

        {/* ── Palette swatch reference ── */}
        <div style={{ marginTop: 52, paddingTop: 32, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Combined palette</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { name: 'rich black',    hex: '#061414', text: '#e9ebe6' },
              { name: 'soft mint',     hex: '#7dd4c0', text: '#061414' },
              { name: 'warm amber',    hex: '#d4a96a', text: '#061414' },
              { name: 'dusty coral',   hex: '#c47f6a', text: '#e9ebe6' },
              { name: 'laurel leaf',   hex: '#96998c', text: '#e9ebe6' },
              { name: 'celeste',       hex: '#d2d3ce', text: '#061414' },
              { name: 'ceiling white', hex: '#e9ebe6', text: '#061414' },
            ].map(({ name, hex, text }) => (
              <div key={name} style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{ height: 52, borderRadius: 14, background: hex, border: `1px solid ${C.border}`, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: text, opacity: 0.7 }}>{hex}</span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{name}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
