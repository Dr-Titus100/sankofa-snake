// The Sankofa bird, drawn for this game: a bird whose feet face forward while its head turns back
// to pick up an egg from its back. The Akan proverb behind the symbol says it is not wrong to go
// back for what you left behind. The body carries a band of kente colors.
export const KENTE = {
  gold: "#F2B705",
  green: "#1E8A3E",
  red: "#C8102E",
  black: "#141010",
  cream: "#F7EEDC",
} as const;

let logoCount = 0;

export function sankofaLogo(size = 120, title = "Sankofa bird"): string {
  const k = KENTE;
  // Each copy of the logo needs its own clip id, or a second copy on the page would borrow the first one's.
  const clip = `ss-body-${++logoCount}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${title}">
  <defs>
    <clipPath id="${clip}"><path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z"/></clipPath>
  </defs>
  <path d="M33 56L11 46L16 60L10 74L33 70Z" fill="${k.gold}" stroke="${k.black}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z" fill="${k.gold}"/>
  <g clip-path="url(#${clip})">
    <rect x="20" y="55" width="70" height="5" fill="${k.green}"/>
    <rect x="20" y="60" width="70" height="3" fill="${k.red}"/>
    <rect x="20" y="63" width="70" height="5" fill="${k.green}"/>
    <rect x="44" y="40" width="3" height="40" fill="${k.black}"/>
    <rect x="58" y="40" width="3" height="40" fill="${k.black}"/>
  </g>
  <path d="M28 60C28 44 46 36 63 42C77 47 82 60 74 70C66 79 45 81 34 74C30 71 28 66 28 60Z" fill="none" stroke="${k.black}" stroke-width="2.5"/>
  <path d="M64 45C72 33 70 21 61 19C55 18 51 22 50 27" fill="none" stroke="${k.black}" stroke-width="10" stroke-linecap="round"/>
  <path d="M64 45C72 33 70 21 61 19C55 18 51 22 50 27" fill="none" stroke="${k.gold}" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="49" cy="29" r="7.5" fill="${k.gold}" stroke="${k.black}" stroke-width="2.5"/>
  <circle cx="51" cy="27" r="1.8" fill="${k.black}"/>
  <path d="M43.5 30L36 38.5L46 35Z" fill="${k.red}" stroke="${k.black}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="34" cy="41" rx="4.6" ry="5.4" transform="rotate(-25 34 41)" fill="${k.cream}" stroke="${k.black}" stroke-width="2"/>
  <path d="M50 78L51 91M51 91L58 91M62 77L65 91M65 91L72 91" fill="none" stroke="${k.black}" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}
