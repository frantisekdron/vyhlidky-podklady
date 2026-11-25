// Produkce na GitHub Pages: přepište data.json novým balíčkem, případně sem vložte jeho veřejnou URL.
const ZDROJ_DAT = "https://frantisekdron.github.io/vyhlidky-podklady/natoceni-b/vyroba-b7k2q/data/dum-b.json";
const ADRESA_POPTAVKY = document.querySelector('meta[name="prijem-poptavek"]')?.content || "";
const FILM_16_9 = ""; // Adresa hotového filmu MP4. Po vyplnění se pod panoramatem zpřístupní přehrávač.

function meritGA4(udalost) {
  // Doplní správce měření po nastavení souhlasů. Událost neobsahuje osobní údaje.
}
function meritKonverziAds(udalost) {
  // Samostatné konverze: "telefon" a "odeslana_poptavka" (jen po potvrzení serveru).
}
let posledniPokus = null;
async function idPoptavky(data) {
  const vstup = new TextEncoder().encode(JSON.stringify(data));
  const otisk = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", vstup)),
    b => b.toString(16).padStart(2,"0")).join("");
  if (!posledniPokus) {
    try { posledniPokus = JSON.parse(sessionStorage.getItem("suchdol-b-pokus")); } catch {}
  }
  if (posledniPokus?.otisk !== otisk) {
    posledniPokus = {otisk, id:crypto.randomUUID()};
    try { sessionStorage.setItem("suchdol-b-pokus", JSON.stringify(posledniPokus)); } catch {}
  }
  return posledniPokus.id;
}
async function odeslatPoptavku(data) {
  const id = await idPoptavky(data);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(ADRESA_POPTAVKY, {
      method: "POST",
      headers: {"Content-Type":"text/plain;charset=utf-8"},
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      body: JSON.stringify({...data, id}),
    });
    if (!response.ok) throw Error("Příjem poptávek neodpovídá.");
    const potvrzeni = await response.json();
    if (potvrzeni.ok !== true || potvrzeni.id !== id || !["odeslano","ulozeno"].includes(potvrzeni.stav)) {
      throw Error("Přijetí nebylo potvrzeno.");
    }
    return potvrzeni;
  } finally { clearTimeout(timeout); }
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
let aktivniNavrh = 0;
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
function kontaktniOdkaz(id, cislo) {
  const a = el(id);
  a.href = "tel:" + cislo.replace(/[^+\d]/g, "");
  a.querySelector("span").textContent = cislo;
  a.onclick = () => {
    meritGA4("telefon");
    meritKonverziAds("telefon");
  };
}
// Úvodní snímek je v HTML, aby se vykreslil ještě před načtením dat galerie.
function vykresliUvod(f) {
  el("cena-modelu").textContent = mena(f.cena_kc);
  el("cena").textContent = mena(f.cena_kc);
  kontaktniOdkaz("hero-tel", f.makler.telefon);
  const staty = [
    ["layout", f.dispozice, "Dispozice"],
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
  el("stav").textContent = "Zkolaudováno · PENB B";
  el("termin").textContent = f.nastehovani;
}
function jeExterier(foto) {
  return foto.patro === "Venku" || /balkon|terasa/i.test(foto.mistnost || foto.nazev);
}

function galerieObrazek(polozka, popis, nahled) {
  const img = obrazek(nahled && polozka.nahled ? polozka.nahled : polozka.url, popis, nahled);
  if (nahled && polozka.nahled) {
    img.srcset = polozka.nahled + " 640w, " + polozka.url + " " + (polozka.sirka || 1700) + "w";
    img.sizes = "(max-width: 600px) 93vw, (max-width: 980px) 46vw, 32vw";
  }
  img.draggable = false;
  return img;
}

function porovnaniFotografie(foto, navrh, nahled) {
  const plocha = prvek("div", "compare " + (nahled ? "compare-inline" : "compare-full"));
  const potom = prvek("div", "compare-layer compare-after");
  const pred = prvek("div", "compare-layer compare-before");
  const poObrazek = galerieObrazek(navrh, navrh.alt || navrh.nazev, nahled);
  const predObrazek = galerieObrazek(foto, foto.alt || foto.nazev, nahled);
  potom.append(poObrazek, prvek("span", "compare-label", "Vizualizace"));
  pred.append(predObrazek, prvek("span", "compare-label", "Dnes"));

  const cara = prvek("span", "divider");
  cara.setAttribute("aria-hidden", "true");
  const jezdec = prvek("span", "compare-handle");
  jezdec.append(ikona("arr"), ikona("arr"));
  cara.append(jezdec);

  const posuv = prvek("input");
  posuv.type = "range";
  posuv.min = "0";
  posuv.max = "100";
  posuv.value = String(foto.zacatek || 42);
  posuv.setAttribute("aria-label", "Porovnat fotografii a vizualizaci – " + foto.nazev);
  function nastavPodil() {
    const pred = Number(posuv.value);
    plocha.style.setProperty("--split", pred + "%");
    posuv.setAttribute("aria-valuetext", "Fotografie " + pred + " %, vizualizace " + (100 - pred) + " %");
  }
  posuv.addEventListener("input", () => {
    nastavPodil();
  });
  nastavPodil();
  if (!nahled) {
    const nastavPomer = () => {
      if (predObrazek.naturalWidth > 0) {
        plocha.style.setProperty("--image-ratio", String(predObrazek.naturalWidth / predObrazek.naturalHeight));
      }
    };
    predObrazek.addEventListener("load", nastavPomer, { once: true });
    nastavPomer();
  }
  plocha.append(potom, pred, cara, posuv);
  return plocha;
}

function kartaGalerie(foto, zvetsit) {
  const karta = prvek("figure", "foto-karta");
  karta.dataset.foto = foto.id;
  const obsah = prvek("div", "foto-obsah");
  const ram = prvek("div", "foto-obraz");
  const navrh = foto.navrhy[0];
  ram.append(navrh ? porovnaniFotografie(foto, navrh, true) : galerieObrazek(foto, foto.alt, true));
  const btn = tlacitko("", zvetsit);
  btn.className = navrh ? "foto-zoom" : "foto-zoom foto-odkaz";
  btn.setAttribute("aria-label", "Zvětšit " + (navrh ? "porovnání" : "fotografii") + " – " + foto.nazev);
  btn.append(ikona("expand"));
  ram.append(btn);
  const caption = prvek("figcaption", "foto-popisek");
  caption.append(prvek("span", "", popisPatra(foto.patro)), prvek("strong", "", foto.nazev));
  if (foto.kratce) caption.append(prvek("small", "", foto.kratce));
  if (foto.poradi === 17) caption.append(prvek("small", "", "Venkovní schodiště je na přání za příplatek."));
  obsah.append(ram, caption);
  karta.append(obsah);
  return karta;
}

function vykresliGalerii(vse) {
  const filtrViz = el("jen-porovnani");
  const galerie = el("nahledy");
  const dalsi = el("dalsi-fotky");
  const cele = el("cela-galerie");
  const filtry = ["Vše", "Interiér", "Exteriér", "Okolí"];
  let filtr = "Vše";
  let vybrane = [];
  let zobrazeno = 0;
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
    for (const {target, contentRect} of entries) {
      target.parentElement.style.gridRowEnd = "span " + Math.ceil((contentRect.height + 22) / 6);
    }
  }) : null;
  if (resize) galerie.classList.add("merena");
  function ukazDalsi(pocet) {
    const prvni = zobrazeno;
    zobrazeno = Math.min(vybrane.length, zobrazeno + pocet);
    const nove = vybrane.slice(prvni,zobrazeno).map((foto,i) => kartaGalerie(foto, () => otevri(vybrane,prvni+i)));
    galerie.append(...nove);
    if (resize) for (const karta of nove) resize.observe(karta.firstElementChild);
    const zbyva = vybrane.length - zobrazeno;
    dalsi.hidden = !zbyva;
    dalsi.textContent = "Zobrazit zbývající snímky (" + zbyva + ")";
    el("pocet-fotek").textContent = zobrazeno + " z " + vybrane.length + " záběrů";
    return nove[0];
  }
  function zobraz() {
    resize?.disconnect();
    galerie.replaceChildren();
    const kategorie = f => [22,25,26,27,28,29,30].includes(f.poradi) ? "Okolí" : jeExterier(f) ? "Exteriér" : "Interiér";
    const kandidati = vse.filter(f => !filtrViz.checked || f.navrhy.length);
    const dostupne = filtry.filter(k => k === "Vše" || kandidati.some(f => kategorie(f) === k));
    if (!dostupne.includes(filtr)) filtr = "Vše";
    vybrane = kandidati.filter(f => filtr === "Vše" || kategorie(f) === filtr);
    zobrazeno = 0;
    el("filtry").replaceChildren(...dostupne.map(k => {
      const btn = tlacitko(k, () => {
        filtr = k;
        zobraz();
        el("filtry").querySelector('[aria-pressed="true"]').focus({preventScroll:true});
      });
      btn.setAttribute("aria-pressed", String(k === filtr));
      return btn;
    }));
    ukazDalsi(14);
  }
  dalsi.onclick = () => {
    const prvni = ukazDalsi(vybrane.length);
    prvni?.querySelector("input,button")?.focus({preventScroll:true});
    prvni?.scrollIntoView({block:"nearest",behavior:"instant"});
  };
  cele.onclick = () => otevri(vybrane,0);
  filtrViz.onchange = zobraz;
  zobraz();
}
function zobrazDialog() {
  puvodniTlacitko = document.activeElement;
  dialog.showModal();
  el("lb-close").focus({ preventScroll: true });
}
function vyberSnimek(i) {
  aktivni = i;
  aktivniNavrh = 0;
  rezim = kolekce[i].navrhy?.length ? "porovnat" : "obrazek";
  vykresliDialog();
}
function otevri(pole, i) {
  kolekce = pole;
  vyberSnimek(i);
  zobrazDialog();
}
for (const serie of document.querySelectorAll("[data-foto-serie]")) {
  const odkazy = Array.from(serie.querySelectorAll("figure a"));
  const fotky = odkazy.map(odkaz => {
    const popisek = odkaz.closest("figure").querySelector("figcaption");
    return {
      druh: "Fotografie domu B",
      nazev: (popisek.firstElementChild || popisek).textContent.trim(),
      alt: odkaz.querySelector("img").alt,
      url: odkaz.getAttribute("href"),
    };
  });
  odkazy.forEach((odkaz, i) => {
    odkaz.addEventListener("click", e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !dialog.showModal) return;
      e.preventDefault();
      otevri(fotky, i);
    });
  });
}
function posun(krok) {
  if (kolekce.length) vyberSnimek((aktivni + krok + kolekce.length) % kolekce.length);
}
function poznamkaKeSnimku(foto) {
  if (foto.druh === "Půdorys") return "Dispozice podlaží. Zakreslené vybavení je pouze návrh.";
  if (foto.druh === "3D model") return "Schéma rozsahu při předání a volitelných doplňků.";
  if (rezim === "dnes" || rezim === "obrazek") return foto.uprava || "";
  if (foto.poznamka) return foto.poznamka;
  if (jeExterier(foto)) return "Bazén a stávající trávník jsou v ceně. Výsadba a zahradní nábytek na návrhu jsou pro představu.";
  if (/koupelna/i.test(foto.nazev)) return "Obklady a sanita jsou v ceně. Zobrazené zařízení a dekorace jsou návrhem.";
  return "Návrh zařízení. Vyobrazený nábytek ani kuchyň nejsou v základní ceně domu.";
}
function vykresliDialog() {
  const foto = kolekce[aktivni];
  const navrh = foto.navrhy?.[aktivniNavrh];
  const popisRezimu = { porovnat: "Dnes / Vizualizace", viz: "Vizualizace", dnes: "Fotografie" };
  const druh = popisRezimu[rezim] || foto.druh || "Fotografie";
  el("lb-kind").textContent = [popisPatra(foto.patro), druh].filter(Boolean).join(" · ");
  el("lb-title").textContent = foto.popis || foto.nazev;
  el("lb-vysvetleni").textContent = poznamkaKeSnimku(foto);
  const snimek = el("lb-frame");
  if (rezim === "porovnat" && navrh) {
    snimek.replaceChildren(porovnaniFotografie(foto, navrh, false));
  } else {
    const obraz = rezim === "viz" && navrh ? navrh : foto;
    snimek.replaceChildren(obrazek(obraz.url, obraz.alt || obraz.popis || obraz.nazev, false));
  }

  const modes = el("lb-modes");
  modes.replaceChildren();
  if (navrh) {
    for (const [mode, label] of [["dnes", "Dnes"], ["porovnat", "Porovnat"], ["viz", "Vizualizace"]]) {
      const tl = tlacitko(label, () => {
        rezim = mode;
        vykresliDialog();
        modes.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
      });
      tl.setAttribute("aria-pressed", String(rezim === mode));
      modes.append(tl);
    }
    if (foto.navrhy.length > 1) {
      const varianty = prvek("select", "vyber-navrhu");
      varianty.setAttribute("aria-label", "Vybrat variantu vizualizace");
      foto.navrhy.forEach((varianta, i) => {
        const option = prvek("option", "", varianta.nazev);
        option.value = String(i);
        varianty.append(option);
      });
      varianty.value = String(aktivniNavrh);
      varianty.onchange = () => {
        aktivniNavrh = Number(varianty.value);
        rezim = "porovnat";
        vykresliDialog();
        modes.querySelector("select").focus({ preventScroll: true });
      };
      modes.append(varianty);
    }
  } else if (foto.druh) {
    const odkaz = prvek("a", "zoom-link", "Otevřít v plném rozlišení ↗");
    odkaz.href = foto.url;
    odkaz.target = "_blank";
    odkaz.rel = "noopener";
    modes.append(odkaz);
  }
  el("lb-count").textContent = aktivni + 1 + " / " + kolekce.length;
  el("lb-prev").hidden = el("lb-next").hidden = kolekce.length < 2;
}
el("lb-close").onclick = () => dialog.close();
el("lb-prev").onclick = () => posun(-1);
el("lb-next").onclick = () => posun(1);
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  el("lb-frame").replaceChildren();
  puvodniTlacitko?.focus({ preventScroll: true });
});
dialog.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select") || !kolekce.length) return;
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
  b.append(obrazek(x.url, x.druh + ": " + x.nazev), stitek(x.druh), zvetseni());
  return b;
}
function vykresliModely(f, model) {
  const popis = model.filter((m) => m.popisky_v_cene_na_prani);
  const najdi = (re) => popis.find((m) => re.test(bezDiakritiky(m.nazev)));
  const skupiny = [
    {
      nadpis: "V ceně při předání",
      seznam: f.v_cene,
      obrazy: [
        [najdi(/rez.*dom/), "Řez domem"],
        [najdi(/v cene/), "Přehled podlaží"],
      ],
    },
    {
      nadpis: "Na přání za příplatek",
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
      radky: ["Základní cena domu " + mena(k.zakladni_cena_kc) + " včetně DPH"],
      celkem: polozky.length ? "Vybrané doplňky: " + polozky.length + " · cena na dotaz" : "Bez vybraných příplatků",
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
    window.aktualizujModelDomu?.(pohled, vybrane);
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
      ["zaluzie", "markyzy", "kuchyn", "dvere", "svitidla", "infrasauna", "wallbox", "kamery"],
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
          prvek("small", "", povoleno ? cenaPolozky(it, true) : it.popis),
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
      "Mám zájem o prohlídku domu B. Prosím o upřesnění rozsahu předání a případné nacenění vybraných doplňků.",
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
// Trasy vedou od domu. Minuty se přebírají ze schválených dojezdů.
function vykresliSmery(f) {
  const dojezdy = f.lokalita.dojezdy || [];
  const kam = [
    { id: "centrum", nadpis: "Centrum Prahy", cil: "Staroměstská, Kaprova, Praha 1",
      popis: "ke Staroměstské", klic: /staromestsk|centrum prahy|praha.{0,5}centrum/ },
    { id: "letiste", nadpis: "Letiště Václava Havla", cil: "Letiště Václava Havla Praha, Terminál 2",
      popis: "na letiště", klic: /letiste/ },
    { id: "udoli", nadpis: "Únětické údolí", cil: "Trojanův mlýn, Suchdol, Praha",
      popis: "k Trojanovu mlýnu v údolí", klic: /trojanuv mlyn|unetic.{0,8}udoli|udoli|unetickeho potoka/ },
  ];
  const pouzite = new Set();
  el("panorama-cile").replaceChildren(...kam.map(({id, nadpis, cil, popis, klic}) => {
    const pesky = id === "udoli";
    const druh = pesky ? "pěšky" : "autem";
    const cas = dojezdy.find(([nazev]) => klic.test(bezDiakritiky(nazev)));
    const delka = cas?.[1]?.trim();
    if (delka) pouzite.add(cas);
    const detail = delka ? (/autem|pěšky|MHD|metrem|busem|minut chůze/i.test(delka) ? delka : delka + " " + druh) : "Zjistit čas " + druh;
    const link = prvek("a", "cil-trasy cil-" + id);
    const params = new URLSearchParams({api:"1", origin:f.adresa, destination:cil, travelmode:pesky ? "walking" : "driving"});
    link.href = "https://www.google.com/maps/dir/?" + params;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Trasa od domu " + popis + " · Google Maps";
    link.setAttribute("aria-label", nadpis + " – " + detail + ". Otevřít trasu od domu " + popis + " v Google Maps.");
    const napis = prvek("span", "cil-text");
    napis.append(prvek("strong", "", nadpis), prvek("small", "", detail));
    link.append(ikona("smer-" + id), napis);
    return link;
  }));
  el("dojezdy").replaceChildren(...dojezdy.filter(radek => !pouzite.has(radek)).map(([nazev, cas]) => {
    const misto = prvek("div");
    misto.append(prvek("strong", "", cas), prvek("small", "", prvniVelke(nazev)));
    return misto;
  }));
  el("dojezdy").parentElement.hidden = !el("dojezdy").children.length;
}
function vykresliLokalitu(f, misto, filmUrl) {
  const [citat] = (f.lokalita.genius_loci || "").split(/\s+–\s+/);
  el("genius").textContent = citat || "";
  const priroda = prvniVelke(f.lokalita.priroda).replace(
    " kousek za domem",
    " začíná kousek za domem",
  );
  el("priroda").textContent = priroda + ".";
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
    frame.hidden = false;
    el("film-stav").hidden = true;
  } else {
    frame.replaceChildren();
    frame.hidden = true;
    el("film-stav").hidden = false;
  }
  el("adresa").textContent = f.adresa;
  vykresliSmery(f);
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
  el("prijemci-poptavky").hidden = false;
  if (ADRESA_POPTAVKY) el("prijemci-poptavky").textContent = "Poptávku obdrží Eva Goldšmíd, Jiří Sládek a FD Studio.";
  if (!ADRESA_POPTAVKY)
    submit.replaceChildren(
      document.createTextNode("Připravit poptávku e-mailem"),
      ikona("ne"),
    );
  for (const input of [form.elements.jmeno, form.elements.email, form.elements.telefon])
    input.oninput = () => {
      form.elements.jmeno.setCustomValidity("");
      form.elements.email.setCustomValidity("");
      form.elements.telefon.setCustomValidity("");
      status.replaceChildren();
    };
  form.addEventListener("input", () => status.replaceChildren());
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    const hodnoty = new FormData(form);
    const text = (k) => String(hodnoty.get(k) || "").trim();
    if (!text("jmeno")) {
      form.elements.jmeno.setCustomValidity("Napište prosím své jméno.");
      form.elements.jmeno.reportValidity();
      return;
    }
    if (!text("telefon") && !text("email")) {
      form.elements.telefon.setCustomValidity(
        "Uveďte prosím telefon nebo e-mail.",
      );
      form.elements.telefon.reportValidity();
      return;
    }
    if (text("telefon") && !/^\+?[\d\s()./-]{3,40}$/.test(text("telefon"))) {
      form.elements.telefon.setCustomValidity("Zkontrolujte prosím telefonní číslo včetně případné předvolby.");
      form.elements.telefon.reportValidity();
      return;
    }
    if (text("email") && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(text("email"))) {
      form.elements.email.setCustomValidity("Zkontrolujte prosím e-mailovou adresu.");
      form.elements.email.reportValidity();
      return;
    }
    const data = {
      formular: "suchdol-b",
      jmeno: text("jmeno"),
      telefon: text("telefon"),
      email: text("email"),
      zprava: text("zprava").replace(posledniSestava || "\u0000", "").trim(),
      souhlas: form.elements.souhlas.checked,
      sestava: seznamPoptavky.map(p => p.id),
      web: text("web"),
    };
    submit.disabled = true;
    status.textContent = ADRESA_POPTAVKY ? "Odesílám poptávku…" : "";
    try {
      if (!ADRESA_POPTAVKY) {
        const body = [
          text("zprava") || "Mám zájem o prohlídku domu B.",
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
          "?cc=" + encodeURIComponent("honza@frantisekdron.cz,j.sladek@seznam.cz") +
          "&subject=" +
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
        const potvrzeni = await odeslatPoptavku(data);
        status.textContent = potvrzeni.stav === "odeslano"
          ? "Děkujeme, poptávku jsme přijali a předali k vyřízení."
          : "Děkujeme, poptávku máme uloženou. K vyřízení ji předáme automaticky.";
        posledniPokus = null;
        try { sessionStorage.removeItem("suchdol-b-pokus"); } catch {}
        const aktualni = new FormData(form);
        if (Array.from(hodnoty.keys()).every(k => hodnoty.get(k) === aktualni.get(k)) && data.souhlas === form.elements.souhlas.checked) {
          form.reset();
          seznamPoptavky = [];
          posledniSestava = "";
        }
        meritGA4("odeslana_poptavka");
        meritKonverziAds("odeslana_poptavka");
      }
    } catch {
      status.textContent =
        "Přijetí se nepodařilo potvrdit. Vyplněné údaje tu zůstaly. Zkuste odeslat znovu nebo zavolejte na " +
        m.telefon +
        ".";
    } finally {
      submit.disabled = false;
    }
  };
}
function vykresli(data) {
  const { fakta: f, galerie, modely, konfigurator: k } = data;
  vykresliUvod(f);
  vykresliGalerii(galerie);
  vykresliModely(f, modely);
  vykresliKonfigurator(k, f);
  vykresliLokalitu(f, null, data.video?.url || FILM_16_9);
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
function otevriRozsah() {
  if (location.hash === "#rozsah-ceny") el("rozsah-ceny").open = true;
}
el("detail-ceny").addEventListener("click", () => { el("rozsah-ceny").open = true; });
window.addEventListener("hashchange", otevriRozsah);
otevriRozsah();

// Fotografie a vizualizace tvoří uzavřený výběr. Vzdálený zdroj může doplnit jen hotovou videoprohlídku.
async function aktualizujFilm(fakta) {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const odpoved = await fetch(ZDROJ_DAT, {credentials:"omit", signal: AbortSignal.timeout(3500)});
    if (!odpoved.ok) return;
    const film = (await odpoved.json()).video?.url;
    if (film && new URL(film).protocol === "https:" && !el("film-ramecek").querySelector("video")) {
      vykresliLokalitu(fakta, null, film);
    }
  } catch { /* Film může být ještě ve výrobě. */ }
}
async function nacti() {
  try {
    async function nactiBalicek(url, signal) {
      const odpoved = await fetch(url, { cache: "no-cache", signal });
      if (!odpoved.ok) throw new Error("Chybí datový balíček.");
      return odpoved.json();
    }
    const mistni = document.getElementById("mistni-podklady");
    const balicek = mistni ? JSON.parse(mistni.textContent) : await nactiBalicek("data.json");
    vykresli(balicek);
    void aktualizujFilm(balicek.fakta);
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
