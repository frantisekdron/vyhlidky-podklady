const anglicky = document.documentElement.lang === "en";
const textProJazyk = (cesky, english) => anglicky ? english : cesky;
const prepinacJazyka = document.querySelector(".language-link");
if (prepinacJazyka) {
  const druhaVerze = new URL(prepinacJazyka.href);
  function nastavOdkazJazyka() {
    druhaVerze.hash = location.hash;
    prepinacJazyka.href = druhaVerze.href;
  }
  nastavOdkazJazyka();
  window.addEventListener("hashchange", nastavOdkazJazyka);
}

function anglickePodklady(data, preklad) {
  function cestaObrazku(url) {
    const soubor = url.slice("assets/".length);
    const original = soubor.replace(/-(640|960)\.webp$/, ".webp");
    return preklad.obrazky.includes(original) ? "graphics/" + soubor : "../" + url;
  }
  function obrazek(item) {
    for (const pole of ["url", "nahled", "stredni", "zaklad", "vrstva"]) {
      if (item[pole]?.startsWith("assets/")) item[pole] = cestaObrazku(item[pole]);
    }
    return item;
  }
  const fakta = {
    ...data.fakta, ...preklad.fakta,
    lokalita: { ...data.fakta.lokalita, ...preklad.fakta.lokalita },
  };
  const galerie = data.galerie.map(foto => {
    const popis = preklad.galerie[foto.id];
    const navrhy = foto.navrhy.map((navrh, i) => obrazek({ ...navrh, ...popis.navrhy[i] }));
    const druh = foto.druh === "Fotografie s popisky" ? "Annotated photograph" : foto.druh ? "Photograph" : undefined;
    return obrazek({ ...foto, ...popis, exterier: jeExterier(foto), druh, navrhy });
  });
  const modely = data.modely.map(m => obrazek({ ...m }));
  const konfigurator = { ...data.konfigurator };
  konfigurator.pohledy = Object.fromEntries(Object.entries(konfigurator.pohledy).map(([id, view]) =>
    [id, obrazek({ ...view, nazev: preklad.pohledy[id] })]));
  konfigurator.polozky = konfigurator.polozky.map(item => obrazek({ ...item, ...preklad.polozky[item.id] }));
  return { ...data, fakta, galerie, modely, konfigurator };
}

// Produkce na GitHub Pages: přepište data.json novým balíčkem, případně sem vložte jeho veřejnou URL.
const ZDROJ_DAT = "https://frantisekdron.github.io/vyhlidky-podklady/natoceni-b/vyroba-b7k2q/data/dum-b.json";
const ADRESA_POPTAVKY = document.querySelector('meta[name="prijem-poptavek"]')?.content || "";
const FILM_16_9 = document.getElementById("film-odkaz")?.getAttribute("href");

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
    if (!response.ok) throw Error(textProJazyk("Příjem poptávek neodpovídá.", "The enquiry service is unavailable."));
    const potvrzeni = await response.json();
    if (potvrzeni.ok !== true || potvrzeni.id !== id || !["odeslano","ulozeno"].includes(potvrzeni.stav)) {
      throw Error(textProJazyk("Přijetí nebylo potvrzeno.", "Receipt could not be confirmed."));
    }
    return potvrzeni;
  } finally { clearTimeout(timeout); }
}

const el = (id) => document.getElementById(id);
const dialog = el("prohlizec");
const menu = document.querySelector(".menu");
const mena = (castka) =>
  new Intl.NumberFormat(anglicky ? "en-GB" : "cs-CZ", {
    style: "currency", currency: "CZK", maximumFractionDigits: 0, minimumFractionDigits: 0,
  }).format(castka);
const bezDiakritiky = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const prvniVelke = (s) =>
  s ? s.charAt(0).toLocaleUpperCase(anglicky ? "en-GB" : "cs-CZ") + s.slice(1) : "";
const popisPatra = (patro) =>
  ({ Venku: textProJazyk("Exteriér", "Exterior"), "1.NP": textProJazyk("1. NP", "Ground floor"), "2.NP": textProJazyk("2. NP", "First floor"), "1.PP": textProJazyk("1. PP", "Lower ground floor") })[
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
function obrazek(url, alt, lazy = true, zdroje, velikosti) {
  const img = new Image();
  img.alt = alt;
  img.decoding = "async";
  img.loading = lazy ? "lazy" : "eager";
  if (zdroje && velikosti) {
    img.sizes = velikosti;
    img.srcset = zdroje;
  }
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
    ["layout", f.dispozice, textProJazyk("Dispozice", "Layout")],
    ["area", f.plochy.uzitna_m2 + " m²", textProJazyk("Užitná plocha", "Usable floor area")],
    ["land", f.plochy.pozemek_m2 + " m²", textProJazyk("Pozemek", "Plot")],
    [
      "pool",
      f.bazen.match(/[\d.,]+\s*[×x]\s*[\d.,]+\s*m/i)?.[0] || f.bazen,
      textProJazyk("Bazén", "Pool"),
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
  el("stav").textContent = textProJazyk("Zkolaudováno v roce 2025 · PENB B", "Approved for occupancy in 2025 · Energy rating B");
  el("termin").textContent = f.nastehovani;
}
function jeExterier(foto) {
  return foto.exterier ?? (foto.patro === "Venku" || /balkon|terasa/i.test(foto.mistnost || foto.nazev));
}

function galerieObrazek(polozka, popis, nahled) {
  const miniatura = nahled && polozka.nahled;
  const vetsi = polozka.stredni ? polozka.stredni + " 960w" : polozka.url + " " + (polozka.sirka || 1700) + "w";
  const img = miniatura
    ? obrazek(miniatura, popis, true, miniatura + " 640w, " + vetsi,
        "auto, (max-width: 600px) 92vw, (max-width: 980px) 46vw, 30vw")
    : obrazek(polozka.url, popis, false);
  img.draggable = false;
  return img;
}

function porovnaniFotografie(foto, navrh, nahled) {
  const plocha = prvek("div", "compare " + (nahled ? "compare-inline" : "compare-full"));
  const potom = prvek("div", "compare-layer compare-after");
  const pred = prvek("div", "compare-layer compare-before");
  const poObrazek = galerieObrazek(navrh, navrh.alt || navrh.nazev, nahled);
  const predObrazek = galerieObrazek(foto, foto.alt || foto.nazev, nahled);
  potom.append(poObrazek, prvek("span", "compare-label", textProJazyk("Vizualizace", "Visualisation")));
  pred.append(predObrazek, prvek("span", "compare-label", textProJazyk("Dnes", "Today")));

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
  posuv.setAttribute("aria-label", textProJazyk("Porovnat fotografii a vizualizaci – ", "Compare photograph and visualisation – ") + foto.nazev);
  function nastavPodil() {
    const pred = Number(posuv.value);
    plocha.style.setProperty("--split", pred + "%");
    posuv.setAttribute("aria-valuetext", textProJazyk("Fotografie ", "Photograph ") + pred + textProJazyk(" %, vizualizace ", "%, visualisation ") + (100 - pred) + textProJazyk(" %", "%"));
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
  btn.setAttribute("aria-label", textProJazyk("Zvětšit ", "Enlarge ") + (navrh ? textProJazyk("porovnání", "comparison") : textProJazyk("fotografii", "photograph")) + " – " + foto.nazev);
  btn.append(ikona("expand"));
  ram.append(btn);
  const caption = prvek("figcaption", "foto-popisek");
  caption.append(prvek("span", "", popisPatra(foto.patro)), prvek("strong", "", foto.nazev));
  if (foto.kratce) caption.append(prvek("small", "", foto.kratce));
  obsah.append(ram, caption);
  karta.append(obsah);
  return karta;
}

function vykresliGalerii(vse) {
  const filtrViz = el("jen-porovnani");
  const galerie = el("nahledy");
  const dalsi = el("dalsi-fotky");
  const cele = el("cela-galerie");
  const filtry = [textProJazyk("Vše", "All"), textProJazyk("Interiér", "Interior"), textProJazyk("Exteriér", "Exterior"), textProJazyk("Okolí", "Surroundings")];
  let filtr = textProJazyk("Vše", "All");
  let vybrane = [];
  let zobrazeno = 0;
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
    requestAnimationFrame(() => {
      for (const {target, contentRect} of entries) {
        const karta = target.parentElement;
        if (!karta?.isConnected) continue;
        const radky = "span " + Math.ceil((contentRect.height + 22) / 6);
        if (karta.style.gridRowEnd !== radky) karta.style.gridRowEnd = radky;
      }
    });
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
    dalsi.textContent = textProJazyk("Zobrazit zbývající snímky (", "Show remaining images (") + zbyva + ")";
    el("pocet-fotek").textContent = zobrazeno + textProJazyk(" z ", " of ") + vybrane.length + textProJazyk(" záběrů", " images");
    return nove[0];
  }
  function zobraz() {
    resize?.disconnect();
    galerie.replaceChildren();
    const kategorie = f => [22,25,26,27,28,29,30].includes(f.poradi) ? textProJazyk("Okolí", "Surroundings") : jeExterier(f) ? textProJazyk("Exteriér", "Exterior") : textProJazyk("Interiér", "Interior");
    const kandidati = vse.filter(f => !filtrViz.checked || f.navrhy.length);
    const dostupne = filtry.filter(k => k === textProJazyk("Vše", "All") || kandidati.some(f => kategorie(f) === k));
    if (!dostupne.includes(filtr)) filtr = textProJazyk("Vše", "All");
    vybrane = kandidati.filter(f => filtr === textProJazyk("Vše", "All") || kategorie(f) === filtr);
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
      druh: textProJazyk("Fotografie současného stavu", "Current photograph"),
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
  if (foto.druh === textProJazyk("Půdorys", "Floor plan")) return textProJazyk("Dispozice podlaží. Zakreslené vybavení je pouze návrh.", "Floor layout. Furnishings are shown as a suggested arrangement.");
  if (foto.druh === "3D model") return textProJazyk("Schéma rozsahu při předání a volitelných doplňků.", "Diagram showing the handover specification and optional extras.");
  if (rezim === "dnes" || rezim === "obrazek") return foto.uprava || "";
  if (foto.poznamka) return foto.poznamka;
  if (jeExterier(foto)) return textProJazyk("Bazén a stávající trávník jsou v ceně. Výsadba a zahradní nábytek na návrhu jsou pro představu.", "The pool and existing lawn are included. The planting and garden furniture are design suggestions.");
  if (/koupelna|bathroom/i.test(foto.nazev)) return textProJazyk("Obklady a sanita jsou v ceně. Zobrazené zařízení a dekorace jsou návrhem.", "Tiling and sanitaryware are included. Furnishings and decorations are shown as suggestions.");
  return textProJazyk("Návrh zařízení. Vyobrazený nábytek ani kuchyň nejsou v základní ceně mezonetu.", "Suggested layout. The furniture and kitchen shown are priced separately.");
}
function vykresliDialog() {
  const foto = kolekce[aktivni];
  const navrh = foto.navrhy?.[aktivniNavrh];
  const popisRezimu = { porovnat: textProJazyk("Dnes / Vizualizace", "Today / Visualisation"), viz: textProJazyk("Vizualizace", "Visualisation"), dnes: textProJazyk("Fotografie", "Photograph") };
  const druh = popisRezimu[rezim] || foto.druh || textProJazyk("Fotografie", "Photograph");
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
    for (const [mode, label] of [["dnes", textProJazyk("Dnes", "Today")], ["porovnat", textProJazyk("Porovnat", "Compare")], ["viz", textProJazyk("Vizualizace", "Visualisation")]]) {
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
      varianty.setAttribute("aria-label", textProJazyk("Vybrat variantu vizualizace", "Choose a visualisation"));
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
    const odkaz = prvek("a", "zoom-link", textProJazyk("Otevřít v plném rozlišení ↗", "Open full-size image ↗"));
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
  b.setAttribute("aria-label", x.druh + " – " + x.nazev + textProJazyk(". Zvětšit obrázek.", ". Enlarge image."));
  b.append(obrazek(x.nahled || x.url, ""), stitek(x.druh), zvetseni());
  return b;
}
function vykresliModely(f, model) {
  const popis = model.filter((m) => m.popisky_v_cene_na_prani);
  const najdi = (re) => popis.find((m) => re.test(bezDiakritiky(m.nazev)));
  const skupiny = [
    {
      nadpis: textProJazyk("V ceně při předání", "Included at handover"),
      seznam: f.v_cene,
      obrazy: [
        [najdi(/rez.*dom/), textProJazyk("Řez domem", "Building cross-section")],
        [najdi(/v cene/), textProJazyk("Přehled podlaží", "Floor overview")],
      ],
    },
    {
      nadpis: textProJazyk("Na přání za příplatek", "Optional extras"),
      seznam: f.na_prani,
      obrazy: [
        [najdi(/na prani.*zahrad/), textProJazyk("Pohled ze zahrady", "Garden view")],
        [najdi(/na prani.*ulic/), textProJazyk("Pohled od ulice", "Street view")],
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
          prvek("summary", "", textProJazyk("Všechny položky (", "All items (") + g.seznam.length + ")"),
          zbytek,
        );
        div.append(detail);
      }
      return div;
    }),
  );
  const patra = [
    ["1PP", textProJazyk("Spodní podlaží", "Garage and poolside studio"), textProJazyk("1. PP", "Lower ground floor")],
    ["1NP", textProJazyk("Obytné podlaží", "Living space"), textProJazyk("1. NP", "Ground floor")],
    ["2NP", textProJazyk("Horní podlaží", "Bedrooms and bathroom"), textProJazyk("2. NP", "First floor")],
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
            druh: textProJazyk("Půdorys", "Floor plan"),
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
  if (!povoleno || !Number.isFinite(it.cena_kc)) return textProJazyk("cena na dotaz", "price on request");
  return (it.cena_od ? textProJazyk("od ", "from ") : it.cena_cca ? textProJazyk("cca ", "approx. ") : "") + mena(it.cena_kc);
}
function sumarizace(k, polozky) {
  if (k.zobrazit_ceny !== true)
    return {
      radky: [textProJazyk("Základní cena mezonetu ", "Maisonette base price ") + mena(k.zakladni_cena_kc) + textProJazyk(" včetně DPH", " including VAT")],
      celkem: polozky.length ? textProJazyk("Vybrané doplňky: ", "Selected extras: ") + polozky.length + textProJazyk(" · cena na dotaz", " · price on request") : textProJazyk("Bez vybraných příplatků", "No extras selected"),
    };
  const priplatky = polozky.reduce(
    (sum, it) => sum + (Number.isFinite(it.cena_kc) ? it.cena_kc : 0),
    0,
  );
  const naDotaz = polozky.some((it) => !Number.isFinite(it.cena_kc));
  const od = polozky.some((it) => it.cena_od);
  const radky = [
    textProJazyk("Základní cena ", "Base price ") + mena(k.zakladni_cena_kc),
    textProJazyk("Vybrané příplatky + ", "Selected extras + ") + (od ? textProJazyk("od ", "from ") : "") + mena(priplatky),
  ];
  return {
    radky,
    celkem:
      textProJazyk("Orientačně ", "Estimated total ") + (od ? textProJazyk("od ", "from ") : "") + mena(k.zakladni_cena_kc + priplatky),
    poznamka: naDotaz
      ? textProJazyk("Položky s cenou na dotaz nejsou v součtu zahrnuty.", "The total excludes items priced on request.")
      : "",
  };
}
function vykresliKonfigurator(k, f) {
  const vybrane = new Set();
  const vstupy = new Map();
  const pohledy = Object.keys(k.pohledy);
  let pohled = pohledy.includes("zahrada") ? "zahrada" : pohledy[0];
  const prenos = "suchdol-b-prepnuti";
  let poptavkaPredPrepnutim;
  try {
    const ulozene = JSON.parse(sessionStorage.getItem(prenos));
    if (ulozene?.jazyk === document.documentElement.lang) {
      sessionStorage.removeItem(prenos);
      if (Date.now() - ulozene.cas < 120000 && Array.isArray(ulozene.volby)) {
        for (const id of ulozene.volby) upravVyber(k.polozky, vybrane, id, true);
        if (pohledy.includes(ulozene.pohled)) pohled = ulozene.pohled;
        if (Array.isArray(ulozene.poptavka)) poptavkaPredPrepnutim = ulozene.poptavka;
      }
    }
  } catch { /* Soukromý režim může vypnout úložiště. */ }
  prepinacJazyka?.addEventListener("click", () => {
    try {
      sessionStorage.setItem(prenos, JSON.stringify({
        jazyk: prepinacJazyka.hreflang, cas: Date.now(), pohled, volby: [...vybrane],
        poptavka: posledniSestava ? seznamPoptavky.map(it => it.id) : null,
      }));
    } catch { /* Odkaz funguje i bez úložiště. */ }
  });
  const nazvy = { zahrada: textProJazyk("Zahrada", "Garden"), ulice: textProJazyk("Ulice", "Street"), rez: textProJazyk("Řez domem", "Building cross-section") };
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
    [textProJazyk("Energie a vytápění", "Energy and heating"), ["fve", "propojeni", "baterie", "tc", "chlazeni"]],
    [textProJazyk("Zahrada a bazén", "Garden and pool"), ["zastreseni", "ohrev", "protiproud", "zavlaha", "schodiste"]],
    [
      textProJazyk("Vybavení a stínění", "Fittings and shading"),
      ["zaluzie", "markyzy", "kuchyn", "dvere", "svitidla", "infrasauna", "wallbox", "kamery"],
    ],
  ];
  const ostatni = k.polozky
    .filter((it) => !skupiny.some(([, ids]) => ids.includes(it.id)))
    .map((it) => it.id);
  if (ostatni.length) skupiny.push([textProJazyk("Další možnosti", "Other options"), ostatni]);
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
  function pripravTextPoptavky(vyber) {
    seznamPoptavky = vyber.map((it) => ({ id: it.id, nazev: it.nazev }));
    const pole = el("zprava");
    const vlastni = posledniSestava
      ? pole.value.replace(posledniSestava, "").trim()
      : pole.value.trim();
    const sestava = [
      textProJazyk("Mám zájem o prohlídku mezonetu. Prosím o upřesnění rozsahu předání a případné nacenění vybraných doplňků.", "I would like to view the maisonette. Please confirm the handover specification and provide prices for any extras listed below."),
      ...vyber.map((it) => "• " + it.nazev + " – " + cenaPolozky(it, povoleno)),
    ];
    if (!vyber.length) sestava.push(textProJazyk("Mezonet v základním provedení.", "Maisonette with the base specification."));
    if (povoleno) {
      const s = sumarizace(k, vyber);
      sestava.push(s.celkem);
      if (s.poznamka) sestava.push(s.poznamka);
    }
    posledniSestava = sestava.join("\n");
    pole.value = [vlastni, posledniSestava].filter(Boolean).join("\n\n");
  }
  if (poptavkaPredPrepnutim) {
    pripravTextPoptavky(k.polozky.filter(it => poptavkaPredPrepnutim.includes(it.id)));
  }
  el("poslat-sestavu").onclick = () => {
    pripravTextPoptavky(k.polozky.filter(it => vybrane.has(it.id)));
    location.hash = "kontakt";
    el("jmeno").focus({ preventScroll: true });
  };
  obnov();
}
// Trasy vedou od domu. Minuty se přebírají ze schválených dojezdů.
function vykresliSmery(f) {
  const dojezdy = f.lokalita.dojezdy || [];
  const kam = [
    { id: "centrum", nadpis: textProJazyk("Centrum Prahy", "Prague city centre"), cil: "Staroměstská, Kaprova, Praha 1",
      popis: textProJazyk("ke Staroměstské", "to Staroměstská in the Old Town"), klic: /staromestsk|centrum prahy|praha.{0,5}centrum/ },
    { id: "letiste", nadpis: textProJazyk("Letiště Václava Havla", "Václav Havel Airport"), cil: "Letiště Václava Havla Praha, Terminál 2",
      popis: textProJazyk("na letiště", "to the airport"), klic: /letiste/ },
    { id: "udoli", nadpis: textProJazyk("Únětické údolí", "Únětice Valley"), cil: "Trojanův mlýn, Suchdol, Praha",
      popis: textProJazyk("k Trojanovu mlýnu v údolí", "to Trojanův mlýn in the valley"), klic: /trojanuv mlyn|unetic.{0,8}udoli|udoli|unetickeho potoka/ },
  ];
  const pouzite = new Set();
  el("panorama-cile").replaceChildren(...kam.map(({id, nadpis, cil, popis, klic}) => {
    const pesky = id === "udoli";
    const druh = pesky ? textProJazyk("pěšky", "on foot") : textProJazyk("autem", "by car");
    const cas = dojezdy.find(([nazev]) => klic.test(bezDiakritiky(nazev)));
    const delka = cas?.[1]?.trim();
    if (delka) pouzite.add(cas);
    const detail = delka ? (/autem|pěšky|MHD|metrem|busem|minut chůze/i.test(delka) ? delka : delka + " " + druh) : textProJazyk("Zjistit čas ", "Check time ") + druh;
    const link = prvek("a", "cil-trasy cil-" + id);
    const params = new URLSearchParams({api:"1", origin:f.adresa, destination:cil, travelmode:pesky ? "walking" : "driving"});
    link.href = "https://www.google.com/maps/dir/?" + params;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = textProJazyk("Trasa od domu ", "Directions from the villa ") + popis + " · Google Maps";
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
function zobrazFilm(filmUrl, plakat) {
  if (!filmUrl) return;
  let url;
  try { url = new URL(filmUrl, document.baseURI); } catch { return; }
  const mistniSoubor = ["http:", "file:"].includes(url.protocol) && url.origin === location.origin;
  if (url.protocol !== "https:" && !mistniSoubor) return;
  const ramecek = el("film-ramecek");
  const odkaz = el("film-odkaz");
  const vimeo = url.hostname === "player.vimeo.com"
    ? url.pathname.match(/^\/video\/(\d+)\/?$/)
    : /^(www\.)?vimeo\.com$/.test(url.hostname) && url.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
  if (vimeo) {
    const prehravac = new URL("https://player.vimeo.com/video/" + vimeo[1] + "?title=0&byline=0&portrait=0&dnt=1");
    const hash = vimeo[2] || url.searchParams.get("h");
    if (hash) prehravac.searchParams.set("h", hash);
    const iframe = prvek("iframe");
    iframe.title = textProJazyk("Videoprohlídka mezonetu v Suchdole", "Video tour of the Suchdol maisonette");
    iframe.loading = "lazy";
    iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.src = prehravac.href;
    ramecek.replaceChildren(iframe);
    odkaz.href = "https://vimeo.com/" + vimeo[1] + (hash ? "/" + encodeURIComponent(hash) : "");
    odkaz.textContent = textProJazyk("Otevřít na Vimeu ↗", "Open on Vimeo ↗");
  } else {
    const video = prvek("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.src = url.href;
    if (plakat) video.poster = plakat;
    video.setAttribute("aria-label", textProJazyk("Videoprohlídka mezonetu", "Maisonette video tour"));
    ramecek.replaceChildren(video);
    odkaz.href = url.href;
    odkaz.textContent = textProJazyk("Otevřít video ↗", "Open video ↗");
  }
  ramecek.hidden = false;
}
function vykresliLokalitu(f, misto, filmUrl) {
  const [citat] = (f.lokalita.genius_loci || "").split(/\s+–\s+/);
  el("genius").textContent = citat || "";
  const priroda = prvniVelke(f.lokalita.priroda).replace(
    " kousek za domem",
    " začíná kousek za domem",
  );
  el("priroda").textContent = priroda + ".";
  zobrazFilm(filmUrl, misto?.foto);
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
  if (ADRESA_POPTAVKY) el("prijemci-poptavky").textContent = textProJazyk("Poptávku obdrží Eva Goldšmíd, Jiří Sládek a FD Studio.", "Your enquiry will reach Eva Goldšmíd, Jiří Sládek and FD Studio.");
  if (!ADRESA_POPTAVKY)
    submit.replaceChildren(
      document.createTextNode(textProJazyk("Připravit poptávku e-mailem", "Prepare email enquiry")),
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
      form.elements.jmeno.setCustomValidity(textProJazyk("Napište prosím své jméno.", "Please enter your name."));
      form.elements.jmeno.reportValidity();
      return;
    }
    if (!text("telefon") && !text("email")) {
      form.elements.telefon.setCustomValidity(
        textProJazyk("Uveďte prosím telefon nebo e-mail.", "Please provide a phone number or an email address."),
      );
      form.elements.telefon.reportValidity();
      return;
    }
    if (text("telefon") && !/^\+?[\d\s()./-]{3,40}$/.test(text("telefon"))) {
      form.elements.telefon.setCustomValidity(textProJazyk("Zkontrolujte prosím telefonní číslo včetně případné předvolby.", "Please check your phone number, including the country code if needed."));
      form.elements.telefon.reportValidity();
      return;
    }
    if (text("email") && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(text("email"))) {
      form.elements.email.setCustomValidity(textProJazyk("Zkontrolujte prosím e-mailovou adresu.", "Please check your email address."));
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
    status.textContent = ADRESA_POPTAVKY ? textProJazyk("Odesílám poptávku…", "Sending enquiry…") : "";
    try {
      if (!ADRESA_POPTAVKY) {
        const body = [
          text("zprava") || textProJazyk("Mám zájem o prohlídku mezonetu.", "I would like to arrange a viewing of the maisonette."),
          data.jmeno,
          data.telefon,
          data.email,
        ]
          .filter(Boolean)
          .join("\n\n");
        const a = prvek("a", "", textProJazyk("Otevřít připravený e-mail ↗", "Open prepared email ↗"));
        a.href =
          "mailto:" +
          m.email +
          "?cc=" + encodeURIComponent("honza@frantisekdron.cz,j.sladek@seznam.cz") +
          "&subject=" +
          encodeURIComponent(textProJazyk("Prohlídka | ", "Viewing enquiry | ") + f.nazev) +
          "&body=" +
          encodeURIComponent(body);
        status.append(
          prvek(
            "p",
            "",
            textProJazyk("Poptávka je připravená. Odešlete ji ze své e-mailové aplikace.", "Your enquiry is ready. Send it from your email app."),
          ),
          a,
        );
        a.focus();
      } else {
        const potvrzeni = await odeslatPoptavku(data);
        status.textContent = potvrzeni.stav === "odeslano"
          ? textProJazyk("Děkujeme, poptávku jsme přijali a předali k vyřízení.", "Thank you. We’ve received your enquiry and forwarded it to the team.")
          : textProJazyk("Děkujeme, poptávku máme uloženou. K vyřízení ji předáme automaticky.", "Thank you. Your enquiry has been saved and will be forwarded automatically.");
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
        textProJazyk("Přijetí se nepodařilo potvrdit. Vyplněné údaje tu zůstaly. Zkuste odeslat znovu nebo zavolejte na ", "We couldn’t confirm receipt. Your details are still here. Try sending again or call ") +
        m.telefon +
        ".";
    } finally {
      submit.disabled = false;
    }
  };
}
function vykresli(data) {
  if (anglicky) data = anglickePodklady(data, prekladWebu);
  const { fakta: f, galerie, modely, konfigurator: k } = data;
  vykresliUvod(f);
  vykresliGalerii(galerie);
  vykresliModely(f, modely);
  vykresliKonfigurator(k, f);
  vykresliLokalitu(f, null, FILM_16_9 || data.video?.url);
  nastavKontakt(f);
  document.querySelector(".loading-error").hidden = true;
}
function zavriMenu() {
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", textProJazyk("Otevřít navigaci", "Open navigation"));
  el("nav").classList.remove("open");
}
menu.onclick = () => {
  if (menu.getAttribute("aria-expanded") === "true") {
    zavriMenu();
    return;
  }
  menu.setAttribute("aria-expanded", "true");
  menu.setAttribute("aria-label", textProJazyk("Zavřít navigaci", "Close navigation"));
  el("nav").classList.add("open");
  el("nav").querySelector("a").focus();
};
el("nav").addEventListener("click", e => {
  const link = e.target.closest("a");
  if (link && menu.getAttribute("aria-expanded") === "true") {
    zavriMenu();
    const cil = document.getElementById(link.hash.slice(1));
    if (cil) {
      cil.tabIndex = -1;
      cil.focus({ preventScroll: true });
    }
  }
});
document.addEventListener("focusin", e => {
  if (menu.getAttribute("aria-expanded") === "true" && e.target !== menu && !el("nav").contains(e.target)) zavriMenu();
});
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
async function aktualizujFilm() {
  if (el("film-ramecek").childElementCount || !/^https?:$/.test(location.protocol)) return;
  try {
    const odpoved = await fetch(ZDROJ_DAT, {credentials:"omit", signal: AbortSignal.timeout(3500)});
    if (!odpoved.ok) return;
    const film = (await odpoved.json()).video?.url;
    if (film && new URL(film).protocol === "https:" && !el("film-ramecek").childElementCount) {
      zobrazFilm(film);
    }
  } catch { /* Film může být ještě ve výrobě. */ }
}
async function nacti() {
  try {
    async function nactiBalicek(url, signal) {
      const odpoved = await fetch(url, { cache: "no-cache", signal });
      if (!odpoved.ok) throw new Error(textProJazyk("Chybí datový balíček.", "The property data could not be found."));
      return odpoved.json();
    }
    const mistni = document.getElementById("mistni-podklady");
    const balicek = mistni ? JSON.parse(mistni.textContent)
      : await nactiBalicek(anglicky ? "../data.json" : "data.json");
    vykresli(balicek);
    void aktualizujFilm();
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
        textProJazyk("Pro náhled z disku vyberte soubor data.json z této složky. ", "To preview from disk, select the property data file. "),
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
            textProJazyk("Tento soubor nelze načíst. Vyberte prosím data.json. ", "This file could not be loaded. Please choose the property data file. ");
        }
      };
    } else {
      chyba.replaceChildren(
        document.createTextNode(textProJazyk("Podklady se nepodařilo načíst. ", "The property details could not be loaded. ")),
      );
      const znovu = tlacitko(textProJazyk("Zkusit znovu", "Try again"), nacti);
      chyba.append(znovu);
    }
  }
}
nacti();
