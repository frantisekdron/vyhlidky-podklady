// Produkce na GitHub Pages: přepište data.json novým balíčkem, případně sem vložte jeho veřejnou URL.
const ZDROJ_DAT = "../natoceni-b/vyroba-b7k2q/data/dum-b.json";
const ADRESA_POPTAVKY = ""; // HTTPS endpoint přijímá POST application/json a potvrzuje úspěch HTTP 2xx.
const FILM_16_9 = ""; // Adresa hotového filmu MP4. Dokud není vyplněna, zobrazí se schválený snímek.

function meritGA4(udalost) {
  // Doplní správce měření po nastavení souhlasů. Událost neobsahuje osobní údaje.
}
function meritKonverziAds(udalost) {
  // Samostatné konverze: "telefon" a "odeslana_poptavka" (jen po potvrzení serveru).
}
async function odeslatPoptavku(data) {
  if (!ADRESA_POPTAVKY) return { rezim: "email" };
  const odpoved = await fetch(ADRESA_POPTAVKY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!odpoved.ok) throw new Error("Poptávku se nepodařilo odeslat.");
  return { rezim: "odeslano" };
}

const el = (id) => document.getElementById(id);
const dialog = el("prohlizec");
const menu = document.querySelector(".menu");
const mena = (castka) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(castka) +
  " Kč";
const bezDiakritiky = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const prvniVelke = (s) =>
  s ? s.charAt(0).toLocaleUpperCase("cs-CZ") + s.slice(1) : "";
const popisPatra = (patro) =>
  ({ Venku: "Exteriér", "1.NP": "1. NP", "2.NP": "2. NP", "1.PP": "1. PP" })[
    patro
  ] || patro;
let seznamPoptavky = [];
let posledniSestava = "";
let kolekce = [];
let aktivni = 0;
let rezim = "obrazek";
let puvodniTlacitko;
function prvek(tag, trida, text) {
  const node = document.createElement(tag);
  if (trida) node.className = trida;
  if (text !== undefined) node.textContent = text;
  return node;
}
function ikona(id) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const use = document.createElementNS(ns, "use");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#" + id);
  svg.append(use);
  return svg;
}
function tlacitko(text, klik) {
  const b = prvek("button", "", text);
  b.type = "button";
  b.addEventListener("click", klik);
  return b;
}
function obrazek(url, alt, lazy = true) {
  const img = new Image();
  img.alt = alt;
  img.decoding = "async";
  img.loading = lazy ? "lazy" : "eager";
  img.src = url;
  return img;
}
function stitek(text) {
  const tag = prvek("span", "photo-tag", text);
  tag.prepend(ikona("image-icon"));
  return tag;
}
function zvetseni() {
  const z = prvek("span", "expand");
  z.append(ikona("expand"));
  return z;
}
function bodySeznamu(pole) {
  return pole.map((text) => prvek("li", "", prvniVelke(text)));
}
function schvalene(obrazky) {
  return obrazky.vizualizace.filter(
    (v) =>
      v.stav === "ok" &&
      !/evin\s+vstup\b/.test(bezDiakritiky(v.skupina + " " + v.nazev)),
  );
}
function kontaktniOdkaz(id, cislo) {
  const a = el(id);
  a.href = "tel:" + cislo.replace(/[^+\d]/g, "");
  a.querySelector("span").textContent = cislo;
  a.onclick = () => {
    meritGA4("telefon");
    meritKonverziAds("telefon");
  };
}
function vykresliUvod(f, fotky, viz) {
  const soumrak = viz.find(
    (v) =>
      /soumrak|vecer|modra hodina/.test(bezDiakritiky(v.nazev)) &&
      /zahrad|bazen/.test(bezDiakritiky(v.nazev)),
  );
  const dnes =
    fotky.find((foto) =>
      /zahrada a bazen/.test(bezDiakritiky(foto.mistnost)),
    ) || fotky[0];
  const h = soumrak || dnes;
  if (h) {
    const img = obrazek(h.url, h.nazev || h.popis, false);
    img.fetchPriority = "high";
    el("hero-media").replaceChildren(img);
    el("hero-credit").replaceChildren(
      stitek(soumrak ? "Vizualizace" : "Fotografie"),
    );
  }
  el("cena").textContent = mena(f.cena_kc);
  kontaktniOdkaz("hero-tel", f.makler.telefon);
  const staty = [
    ["layout", f.typ.match(/\d+\s*\+\s*(?:kk|\d+)/i)?.[0], "Dispozice"],
    ["area", f.plochy.uzitna_m2 + " m²", "Užitná plocha"],
    ["land", f.plochy.pozemek_m2 + " m²", "Pozemek"],
    [
      "pool",
      f.bazen.match(/[\d.,]+\s*[×x]\s*[\d.,]+\s*m/i)?.[0] || f.bazen,
      "Bazén",
    ],
  ];
  el("cisla").replaceChildren(
    ...staty.map(([id, hodnota, nadpis]) => {
      const box = prvek("div", "stat"),
        t = prvek("div");
      t.append(prvek("b", "", hodnota), prvek("small", "", nadpis));
      box.append(ikona(id), t);
      return box;
    }),
  );
  el("stav").textContent = /hotový a zkolaudovaný/i.test(f.typ)
    ? "Hotovo a zkolaudováno"
    : prvniVelke(f.typ);
  el("termin").textContent = "Nastěhování " + f.nastehovani + ".";
  return h;
}
function stejnaFotka(a, b) {
  if (!a || !b) return false;
  const soubor = (u) => u.split(/[?#]/)[0].split("/").pop();
  return a === b || soubor(a) === soubor(b);
}

// Jeden pohled na prostor. Schválená úprava a její podklad patří do stejné karty.
function vyberGalerii(fotky, navrhy, vyhrazene) {
  const pouzity = (url) =>
    url &&
    vyhrazene.some(
      (z) => z && [z.url, z.foto].some((u) => stejnaFotka(url, u)),
    );
  const karty = new Map();
  const pridej = (key, karta) => {
    if (!karty.has(key) && !pouzity(karta.url) && !pouzity(karta.foto))
      karty.set(key, karta);
  };
  const klic = (p) => p.patro + "/" + p.mistnost;
  for (const v of navrhy) {
    const p = fotky.find((p) => stejnaFotka(p.url, v.foto));
    const titulek = v.nazev.replace(/^kolo\s+\d+\s*[·:–-]\s*/i, "");
    const jmeno =
      p?.mistnost === "Pokoj"
        ? titulek.match(/pokoj\s+(SV|JV|SZ|JZ)\b/i)?.[0] || p.mistnost
        : p?.mistnost;
    const key = p ? p.patro + "/" + jmeno : "viz/" + (v.foto || v.url);
    pridej(key, {
      ...v,
      nazev: jmeno || titulek,
      popis: p?.popis,
      patro: p?.patro || (/dron/i.test(titulek) ? "Venku" : ""),
      ai: true,
    });
  }
  for (const p of fotky) {
    if (
      p.mistnost === "Pokoj" &&
      [...karty.keys()].some((k) => k.startsWith(klic(p) + " "))
    )
      continue;
    pridej(klic(p), { ...p, nazev: p.mistnost });
  }
  const vse = [...karty.values()];
  const hlavni = [
    vse.find((x) => x.patro === "1.NP"),
    vse.find((x) => x.nazev === "Ložnice"),
    vse.find((x) => x.nazev === "Zahrada a bazén"),
  ].filter(Boolean);
  return [...new Set([...hlavni, ...vse])];
}
function vykresliGalerii(vse) {
  let vybrane = vse;
  let filtr = "Vše";
  const filtry = ["Vše", "Interiér", "Exteriér"].filter(
    (f) =>
      f === "Vše" ||
      vse.some((x) => (x.patro === "Venku") === (f === "Exteriér")),
  );
  function kresli() {
    vybrane = vse.filter(
      (x) =>
        filtr === "Vše" || (x.patro === "Venku") === (filtr === "Exteriér"),
    );
    el("filtry").replaceChildren(
      ...filtry.map((f) => {
        const b = tlacitko(popisPatra(f), () => {
          filtr = f;
          kresli();
          el("filtry")
            .querySelector('[aria-pressed="true"]')
            .focus({ preventScroll: true });
        });
        b.setAttribute("aria-pressed", String(filtr === f));
        return b;
      }),
    );
    el("nahledy").replaceChildren(
      ...vybrane.slice(0, 3).map((x, i) => {
        const b = tlacitko("", () => otevri(vybrane, i));
        b.className = "photo-card";
        b.setAttribute(
          "aria-label",
          "Otevřít " + (x.ai ? "vizualizaci" : "fotografii") + " – " + x.nazev,
        );
        const img = obrazek(x.nahled || x.url, x.popis || x.nazev);
        // Větší dlaždice potřebuje víc než původní náhled 480 px.
        if (!x.ai && i === 0 && x.nahled) {
          img.srcset = x.nahled + " 480w, " + x.url + " 1600w";
          img.sizes = "(max-width:720px) 95vw, 58vw";
        }
        const tags = prvek("span", "card-tags");
        if (x.ai) tags.append(stitek("Vizualizace"));
        const info = prvek("span", "card-bottom"),
          nazev = prvek("span");
        nazev.append(
          prvek("small", "", popisPatra(x.patro) || "Dům B"),
          prvek("strong", "", x.nazev),
        );
        info.append(nazev, zvetseni());
        b.append(img, tags, info);
        const tile = prvek("div", "mosaic-tile");
        tile.append(b);
        if (x.foto || x.par?.foto) {
          const porovnat = tlacitko("Porovnat ↔", () =>
            otevri(vybrane, i, "porovnat"),
          );
          porovnat.className = "card-compare";
          porovnat.setAttribute(
            "aria-label",
            "Porovnat dnešní stav a vizualizaci – " + x.nazev,
          );
          tile.append(porovnat);
        }
        return tile;
      }),
    );
    const b = el("cela-galerie");
    b.replaceChildren(
      document.createTextNode(
        "Prohlédnout " +
          (filtr === "Vše" ? "celou galerii" : "výběr") +
          " (" +
          vybrane.length +
          ")",
      ),
      ikona("arr"),
    );
    b.disabled = !vybrane.length;
    b.onclick = () => otevri(vybrane, 0);
  }
  kresli();
}
function zobrazDialog() {
  puvodniTlacitko = document.activeElement;
  dialog.showModal();
  el("lb-close").focus({ preventScroll: true });
}
function otevri(pole, i, vychoziRezim = "obrazek") {
  kolekce = pole;
  aktivni = i;
  rezim = vychoziRezim;
  vykresliDialog();
  zobrazDialog();
}
function posun(krok) {
  if (!kolekce.length) return;
  aktivni = (aktivni + krok + kolekce.length) % kolekce.length;
  rezim = "obrazek";
  vykresliDialog();
}
function vykresliDialog() {
  const x = kolekce[aktivni],
    par = x.ai ? x : x.par;
  const snimek = el("lb-frame");
  snimek.replaceChildren();
  const jeNavrh = rezim === "viz" || (rezim === "obrazek" && x.ai);
  el("lb-kind").textContent = [
    popisPatra(x.patro),
    rezim === "porovnat"
      ? "Dnes / Vizualizace"
      : jeNavrh
        ? "Vizualizace"
        : x.druh || "Fotografie",
  ]
    .filter(Boolean)
    .join(" · ");
  const zobrazujeFoto =
    rezim === "dnes" || (rezim === "obrazek" && !x.ai && !x.druh);
  el("lb-title").textContent = zobrazujeFoto
    ? x.popis || par?.popis || x.nazev
    : par?.nazev || x.nazev;
  if (rezim === "porovnat" && par?.foto) {
    const s = prvek("div", "compare"),
      pred = obrazek(par.foto, "Dnešní stav", false);
    pred.className = "before";
    const posuv = prvek("input");
    posuv.type = "range";
    posuv.min = 0;
    posuv.max = 100;
    posuv.value = 50;
    posuv.setAttribute("aria-label", "Podíl fotografie dnešního stavu");
    posuv.setAttribute("aria-valuetext", "Dnes 50 %");
    posuv.oninput = () => {
      s.style.setProperty("--split", posuv.value + "%");
      posuv.setAttribute("aria-valuetext", "Dnes " + posuv.value + " %");
    };
    const dnes = stitek("Dnes");
    dnes.classList.add("today");
    s.append(
      obrazek(par.url, par.nazev, false),
      pred,
      prvek("span", "divider"),
      posuv,
      dnes,
      stitek("Vizualizace"),
    );
    snimek.append(s);
  } else {
    const url = rezim === "dnes" ? par.foto : rezim === "viz" ? par.url : x.url;
    snimek.append(obrazek(url, x.nazev, false));
    if (jeNavrh) snimek.append(stitek("Vizualizace"));
  }
  const modes = el("lb-modes");
  modes.replaceChildren();
  if (par?.foto) {
    const aktualni = rezim === "obrazek" ? (x.ai ? "viz" : "dnes") : rezim;
    for (const [mode, label] of [
      ["dnes", "Dnes"],
      ["porovnat", "Porovnat ↔"],
      ["viz", "Vizualizace"],
    ]) {
      const b = tlacitko(label, () => {
        rezim = mode;
        vykresliDialog();
        modes
          .querySelector('[aria-pressed="true"]')
          .focus({ preventScroll: true });
      });
      b.setAttribute("aria-pressed", String(aktualni === mode));
      modes.append(b);
    }
  } else if (x.druh) {
    const a = prvek("a", "zoom-link", "Otevřít v plném rozlišení ↗");
    a.href = x.url;
    a.target = "_blank";
    a.rel = "noopener";
    modes.append(a);
  }
  el("lb-count").textContent = aktivni + 1 + " / " + kolekce.length;
  el("lb-prev").hidden = el("lb-next").hidden = kolekce.length < 2;
}
el("lb-close").onclick = () => dialog.close();
el("lb-prev").onclick = () => posun(-1);
el("lb-next").onclick = () => posun(1);
dialog.addEventListener("close", () => {
  el("lb-frame").replaceChildren();
  puvodniTlacitko?.focus({ preventScroll: true });
});
dialog.addEventListener("keydown", (e) => {
  if (e.target.type === "range" || !kolekce.length) return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    posun(e.key === "ArrowRight" ? 1 : -1);
  }
});
let dotek;
el("lb-frame").addEventListener(
  "touchstart",
  (e) => {
    dotek =
      e.touches.length === 1 && !e.target.closest(".compare,video")
        ? [e.touches[0].clientX, e.touches[0].clientY]
        : null;
  },
  { passive: true },
);
el("lb-frame").addEventListener(
  "touchend",
  (e) => {
    if (!dotek) return;
    const dx = e.changedTouches[0].clientX - dotek[0],
      dy = e.changedTouches[0].clientY - dotek[1];
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
      posun(dx < 0 ? 1 : -1);
    dotek = null;
  },
  { passive: true },
);
function tabule(x, pole, i) {
  const b = tlacitko("", () => otevri(pole, i));
  b.className = "board";
  b.setAttribute("aria-label", "Zvětšit – " + x.nazev);
  b.append(obrazek(x.url, x.nazev), zvetseni());
  return b;
}
function vykresliModely(f, model) {
  const popis = model.filter((m) => m.popisky_v_cene_na_prani);
  const najdi = (re) => popis.find((m) => re.test(bezDiakritiky(m.nazev)));
  const skupiny = [
    {
      nadpis: "V ceně",
      seznam: f.v_cene,
      obrazy: [
        [najdi(/rez.*dom/), "Řez domem"],
        [najdi(/v cene/), "Přehled podlaží"],
      ],
    },
    {
      nadpis: "Na přání",
      seznam: f.na_prani,
      obrazy: [
        [najdi(/na prani.*zahrad/), "Pohled ze zahrady"],
        [najdi(/na prani.*ulic/), "Pohled od ulice"],
      ],
    },
  ];
  el("modely").replaceChildren(
    ...skupiny.map((g) => {
      const div = prvek("article");
      const pole = g.obrazy
        .filter(([m]) => m)
        .map(([m, t]) => ({
          ...m,
          nazev: t + " · " + g.nadpis,
          druh: "3D model",
        }));
      if (pole.length) div.append(tabule(pole[0], pole, 0));
      div.append(prvek("h3", "", g.nadpis));
      const list = prvek("ul", "equips");
      list.append(...bodySeznamu(g.seznam.slice(0, 4)));
      div.append(list);
      if (g.seznam.length > 4) {
        const detail = prvek("details"),
          zbytek = prvek("ul", "equips");
        zbytek.append(...bodySeznamu(g.seznam.slice(4)));
        detail.append(
          prvek("summary", "", "Všechny položky (" + g.seznam.length + ")"),
          zbytek,
        );
        div.append(detail);
      }
      return div;
    }),
  );
  const patra = [
    ["1PP", "Spodní podlaží", "1. PP"],
    ["1NP", "Obytné podlaží", "1. NP"],
    ["2NP", "Horní podlaží", "2. NP"],
  ];
  const plany = patra.flatMap(([kod, t, patro]) => {
    const m = model.find((x) => {
      const n = bezDiakritiky(x.nazev).replace(/[._\s]/g, "");
      return (
        n.includes("pudorys") &&
        n.includes(kod.toLowerCase()) &&
        !n.includes("nahled")
      );
    });
    return m
      ? [
          {
            ...m,
            url: /01_pudorys_(1PP|1NP|2NP)\.jpg$/.test(m.url)
              ? "assets/01_pudorys_" + kod + "_vykres.webp"
              : m.url,
            nazev: t,
            patro,
            druh: "Půdorys",
          },
        ]
      : [];
  });
  el("plany").replaceChildren(
    ...plany.map((p, i) => {
      const box = prvek("article");
      box.append(
        tabule(p, plany, i),
        prvek("h3", "", p.patro + " · " + p.nazev),
      );
      return box;
    }),
  );
}

function pozadavky(it) {
  if (Array.isArray(it.vyzaduje)) return it.vyzaduje;
  return it.vyzaduje ? [it.vyzaduje] : [];
}
function upravVyber(polozky, vybrane, id, zapnout) {
  const it = polozky.find((x) => x.id === id);
  if (!it || vybrane.has(id) === zapnout) return;
  if (zapnout) {
    vybrane.add(id);
    pozadavky(it).forEach((p) => upravVyber(polozky, vybrane, p, true));
  } else {
    vybrane.delete(id);
    polozky
      .filter((x) => pozadavky(x).includes(id))
      .forEach((x) => upravVyber(polozky, vybrane, x.id, false));
  }
}
function cenaPolozky(it, povoleno) {
  if (!povoleno || !Number.isFinite(it.cena_kc)) return "cena na dotaz";
  return (it.cena_od ? "od " : it.cena_cca ? "cca " : "") + mena(it.cena_kc);
}
function sumarizace(k, polozky) {
  if (k.zobrazit_ceny !== true)
    return {
      radky: ["Vybrané položky: " + polozky.length],
      celkem: "Cena sestavy na dotaz",
    };
  const priplatky = polozky.reduce(
    (sum, it) => sum + (Number.isFinite(it.cena_kc) ? it.cena_kc : 0),
    0,
  );
  const naDotaz = polozky.some((it) => !Number.isFinite(it.cena_kc));
  const od = polozky.some((it) => it.cena_od);
  const radky = [
    "Základní cena " + mena(k.zakladni_cena_kc),
    "Vybrané příplatky + " + (od ? "od " : "") + mena(priplatky),
  ];
  return {
    radky,
    celkem:
      "Orientačně " + (od ? "od " : "") + mena(k.zakladni_cena_kc + priplatky),
    poznamka: naDotaz
      ? "Položky s cenou na dotaz nejsou v součtu zahrnuty."
      : "",
  };
}
function vykresliKonfigurator(k, f) {
  const vybrane = new Set();
  const vstupy = new Map();
  const pohledy = Object.keys(k.pohledy);
  let pohled = pohledy.includes("zahrada") ? "zahrada" : pohledy[0];
  const nazvy = { zahrada: "Zahrada", ulice: "Ulice", rez: "Řez domem" };
  const povoleno = k.zobrazit_ceny === true;
  el("zaklad").replaceChildren(...bodySeznamu(f.v_cene));
  const podminky = el("podminky");
  if (podminky && k.podminky_priplatku) {
    podminky.textContent = k.podminky_priplatku;
    podminky.hidden = false;
  }
  const taby = new Map();
  el("pohledy").replaceChildren(
    ...pohledy.map((p) => {
      const b = tlacitko(nazvy[p] || k.pohledy[p].nazev, () => {
        pohled = p;
        model();
      });
      b.title = k.pohledy[p].nazev;
      taby.set(p, b);
      return b;
    }),
  );
  function model() {
    for (const [p, b] of taby)
      b.setAttribute("aria-pressed", String(p === pohled));
    const stage = el("platno");
    if (!k.pohledy[pohled]) return;
    const vrstvy = k.polozky.filter(
      (i) => vybrane.has(i.id) && i.pohled === pohled && i.vrstva,
    );
    const urls = [k.pohledy[pohled].zaklad, ...vrstvy.map((i) => i.vrstva)];
    // Načítají se pouze vrstvy vybraného pohledu. Obrázky mají shodný rám 1920 × 1200.
    const obrazky = urls.map(
      (u) =>
        Array.from(stage.children).find(
          (img) => img.getAttribute("src") === u,
        ) || obrazek(u, ""),
    );
    stage.replaceChildren(...obrazky);
    stage.setAttribute(
      "aria-label",
      [k.pohledy[pohled].nazev, ...vrstvy.map((i) => i.nazev)].join(" · "),
    );
  }
  const skupiny = [
    ["Energie a vytápění", ["fve", "propojeni", "baterie", "tc", "chlazeni"]],
    ["Zahrada a bazén", ["zastreseni", "ohrev", "protiproud", "zavlaha", "schodiste"]],
    [
      "Vybavení a stínění",
      ["zaluzie", "kuchyn", "dvere", "svitidla", "infrasauna", "wallbox", "kamery"],
    ],
  ];
  const ostatni = k.polozky
    .filter((it) => !skupiny.some(([, ids]) => ids.includes(it.id)))
    .map((it) => it.id);
  if (ostatni.length) skupiny.push(["Další možnosti", ostatni]);
  function obnov() {
    for (const [id, input] of vstupy) input.checked = vybrane.has(id);
    model();
    const vyber = k.polozky.filter((it) => vybrane.has(it.id)),
      suma = sumarizace(k, vyber);
    el("soucet").replaceChildren(
      ...suma.radky.map((r) => prvek("p", "", r)),
      prvek("strong", "", suma.celkem),
    );
    if (suma.poznamka) el("soucet").append(prvek("p", "", suma.poznamka));
  }
  el("volby").replaceChildren(
    ...skupiny.flatMap(([nadpis, ids], index) => {
      const polozky = k.polozky.filter((it) => ids.includes(it.id));
      if (!polozky.length) return [];
      const detail = prvek("details", "option-group");
      detail.open = index === 0;
      detail.append(prvek("summary", "", nadpis));
      for (const it of polozky) {
        const label = prvek("label", "option-row"),
          popis = prvek("span");
        popis.append(
          prvek("strong", "", it.nazev),
          prvek("small", "", cenaPolozky(it, povoleno)),
        );
        const input = prvek("input", "switch");
        input.type = "checkbox";
        input.id = "doplnit-" + it.id;
        input.setAttribute("role", "switch");
        input.onchange = () => {
          upravVyber(k.polozky, vybrane, it.id, input.checked);
          if (input.checked) {
            const zdroj = it.pohled
              ? it
              : k.polozky.find((p) => pozadavky(it).includes(p.id) && p.vrstva);
            if (zdroj && k.pohledy[zdroj.pohled]) pohled = zdroj.pohled;
          }
          obnov();
        };
        vstupy.set(it.id, input);
        label.append(popis, input);
        detail.append(label);
      }
      return [detail];
    }),
  );
  el("poslat-sestavu").onclick = () => {
    const vyber = k.polozky.filter((it) => vybrane.has(it.id));
    seznamPoptavky = vyber.map((it) => ({ id: it.id, nazev: it.nazev }));
    const pole = el("zprava");
    const vlastni = posledniSestava
      ? pole.value.replace(posledniSestava, "").trim()
      : pole.value.trim();
    const sestava = [
      "Mám zájem o prohlídku domu B a o tuto sestavu.",
      ...vyber.map((it) => "• " + it.nazev + " – " + cenaPolozky(it, povoleno)),
    ];
    if (!vyber.length) sestava.push("Dům v základním vybavení.");
    if (povoleno) {
      const s = sumarizace(k, vyber);
      sestava.push(s.celkem);
      if (s.poznamka) sestava.push(s.poznamka);
    }
    posledniSestava = sestava.join("\n");
    pole.value = [vlastni, posledniSestava].filter(Boolean).join("\n\n");
    location.hash = "kontakt";
    el("jmeno").focus({ preventScroll: true });
  };
  obnov();
}
function vykresliLokalitu(f, misto, filmUrl) {
  const [citat] = (f.lokalita.genius_loci || "").split(/\s+–\s+/);
  el("genius").textContent = citat || "";
  const priroda = prvniVelke(f.lokalita.priroda).replace(
    " kousek za domem",
    " začíná kousek za domem",
  );
  const cyklo = f.lokalita.cyklostezka
    ? " " + prvniVelke(f.lokalita.cyklostezka) + "."
    : "";
  el("priroda").textContent = priroda + "." + cyklo;
  const frame = el("film-ramecek");
  if (filmUrl) {
    const video = prvek("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.src = filmUrl;
    if (misto?.foto) video.poster = misto.foto;
    video.setAttribute("aria-label", "Videoprohlídka domu B");
    frame.replaceChildren(video);
    el("film-stav").textContent = "Film o domě";
  } else {
    frame.replaceChildren();
    if (misto?.foto)
      frame.append(
        obrazek(misto.foto, "Pohled z dronu na dům a okolní zástavbu Suchdola"),
      );
    else frame.append(prvek("span", "film-empty", "Vyhlídky Suchdol"));
    el("film-stav").textContent = "Film připravujeme";
  }
  el("adresa").textContent = f.adresa;
  el("dojezdy").replaceChildren(
    ...f.lokalita.dojezdy.map(([kam, jakDlouho]) => {
      const t = prvek("div");
      t.append(
        prvek("strong", "", jakDlouho),
        prvek("small", "", prvniVelke(kam)),
      );
      return t;
    }),
  );
}
function nastavKontakt(f) {
  const m = f.makler;
  el("makler").textContent = m.jmeno;
  el("kancelar").textContent = m.firma;
  kontaktniOdkaz("kontakt-tel", m.telefon);
  el("kontakt-mail").href = "mailto:" + m.email;
  el("kontakt-mail").textContent = m.email;
  const form = el("formular"),
    status = el("vysledek"),
    submit = el("odeslat");
  submit.disabled = false;
  if (!ADRESA_POPTAVKY)
    submit.replaceChildren(
      document.createTextNode("Připravit poptávku e-mailem"),
      ikona("ne"),
    );
  for (const input of [form.elements.email, form.elements.telefon])
    input.oninput = () => {
      form.elements.telefon.setCustomValidity("");
      status.replaceChildren();
    };
  form.addEventListener("input", () => status.replaceChildren());
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    const hodnoty = new FormData(form);
    const text = (k) => String(hodnoty.get(k) || "").trim();
    if (!text("telefon") && !text("email")) {
      form.elements.telefon.setCustomValidity(
        "Uveďte prosím telefon nebo e-mail.",
      );
      form.elements.telefon.reportValidity();
      return;
    }
    const data = {
      nemovitost: f.nazev,
      jmeno: text("jmeno"),
      telefon: text("telefon"),
      email: text("email"),
      zprava: text("zprava"),
      souhlas: form.elements.souhlas.checked,
      sestava: seznamPoptavky,
    };
    submit.disabled = true;
    status.textContent = "";
    try {
      const vysledek = await odeslatPoptavku(data);
      if (vysledek.rezim === "email") {
        const body = [
          data.zprava || "Mám zájem o prohlídku domu B.",
          data.jmeno,
          data.telefon,
          data.email,
        ]
          .filter(Boolean)
          .join("\n\n");
        const a = prvek("a", "", "Otevřít připravený e-mail ↗");
        a.href =
          "mailto:" +
          m.email +
          "?subject=" +
          encodeURIComponent("Prohlídka | " + f.nazev) +
          "&body=" +
          encodeURIComponent(body);
        status.append(
          prvek(
            "p",
            "",
            "Poptávka je připravená. Odešlete ji ze své e-mailové aplikace.",
          ),
          a,
        );
        a.focus();
      } else {
        status.textContent =
          "Děkuji za zprávu. Ozvu se Vám kvůli termínu prohlídky.";
        form.reset();
        seznamPoptavky = [];
        posledniSestava = "";
        meritGA4("odeslana_poptavka");
        meritKonverziAds("odeslana_poptavka");
      }
    } catch {
      status.textContent =
        "Odeslání se nepodařilo. Zkuste to prosím znovu nebo zavolejte na " +
        m.telefon +
        ".";
    } finally {
      submit.disabled = false;
    }
  };
}
function vykresli(data) {
  const { fakta: f, obrazky: o, konfigurator: k } = data;
  const kolo = (v) =>
    Number((v.nazev + " " + v.skupina).match(/kolo\s+(\d+)/i)?.[1] || 1);
  const navrhy = schvalene(o).sort((a, b) => kolo(b) - kolo(a));
  const uvod = vykresliUvod(f, o.fotky, navrhy);
  const misto = navrhy.find((v) => v.foto && /lokalit/i.test(v.nazev));
  vykresliGalerii(vyberGalerii(o.fotky, navrhy, [uvod, misto]));
  vykresliModely(f, o.model3d);
  vykresliKonfigurator(k, f);
  vykresliLokalitu(f, misto, data.video?.url || FILM_16_9);
  nastavKontakt(f);
  document.querySelector(".loading-error").hidden = true;
}
function zavriMenu() {
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Otevřít navigaci");
  el("nav").classList.remove("open");
}
menu.onclick = () => {
  if (menu.getAttribute("aria-expanded") === "true") {
    zavriMenu();
    return;
  }
  menu.setAttribute("aria-expanded", "true");
  menu.setAttribute("aria-label", "Zavřít navigaci");
  el("nav").classList.add("open");
};
el("nav").addEventListener("click", zavriMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    zavriMenu();
    menu.focus();
  }
});
async function nacti() {
  try {
    const odpoved = await fetch(ZDROJ_DAT, { cache: "no-cache" });
    if (!odpoved.ok) throw new Error("Chybí datový balíček.");
    vykresli(await odpoved.json());
  } catch {
    const chyba = document.querySelector(".loading-error");
    chyba.hidden = false;
    if (location.protocol === "file:") {
      // Pro lokální kontrolu rozbaleného ZIPu i v prohlížečích, které blokují fetch z disku.
      const input = prvek("input");
      input.type = "file";
      input.accept = ".json,application/json";
      const label = prvek(
        "label",
        "",
        "Pro náhled z disku vyberte soubor data.json z této složky. ",
      );
      label.append(input);
      chyba.replaceChildren(label);
      document.body.append(chyba);
      chyba.classList.add("file-picker");
      input.onchange = async () => {
        try {
          vykresli(JSON.parse(await input.files[0].text()));
        } catch {
          label.firstChild.textContent =
            "Tento soubor nelze načíst. Vyberte prosím data.json. ";
        }
      };
    } else {
      chyba.replaceChildren(
        document.createTextNode("Podklady se nepodařilo načíst. "),
      );
      const znovu = tlacitko("Zkusit znovu", nacti);
      chyba.append(znovu);
    }
  }
}
nacti();
