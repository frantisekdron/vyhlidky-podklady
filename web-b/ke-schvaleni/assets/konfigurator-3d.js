(() => {
  const anglicky = document.documentElement.lang === "en";
  const textProJazyk = (cesky, english) => anglicky ? english : cesky;
  const skriptUrl = document.currentScript.src;
  const scena = document.getElementById("scena-domu");
  const model = document.getElementById("model-konfiguratoru");
  const schema = document.getElementById("platno");
  const popis = document.getElementById("napoveda-modelu");
  const nastroje = document.getElementById("ovladani-kamery");
  const prepnout = document.getElementById("zmena-zobrazeni");
  const kamery = {
    zahrada: { uhel: "-112deg 64deg", vzdalenost: [44, 49], cil: "-9m 3m -3.6m" },
    ulice: { uhel: "118deg 66deg", vzdalenost: [35, 44], cil: "-3m 4m -3.6m" },
  };
  let pohled = "zahrada";
  let sestava = new Set();
  let materialy = [];
  let pripraven = false;
  let nacteni;
  let pevny = false;
  let chyba = false;
  const uzky = matchMedia("(max-width: 760px)");
  const maloPohybu = matchMedia("(prefers-reduced-motion: reduce)");
  function vratKameru(ihned = false) {
    const kamera = kamery[pohled];
    if (!kamera || !pripraven) return;
    model.cameraTarget = kamera.cil;
    model.cameraOrbit = kamera.uhel + " " + kamera.vzdalenost[uzky.matches ? 1 : 0] + "m";
    model.fieldOfView = "26deg";
    if (ihned || maloPohybu.matches) model.jumpCameraToGoal();
  }
  function prepniMaterialy() {
    for (const polozka of materialy) {
      const { id, material, barva, kryti } = polozka;
      const zapnuto = id === "bez-schodiste" ? !sestava.has("schodiste") : sestava.has(id);
      if (polozka.zapnuto === zapnuto) continue;
      material.setAlphaMode(zapnuto ? (kryti < 1 ? "BLEND" : "OPAQUE") : "MASK");
      material.pbrMetallicRoughness.setBaseColorFactor([...barva, zapnuto ? kryti : 0]);
      polozka.zapnuto = zapnuto;
    }
  }
  function zobraz() {
    const rez = pohled === "rez";
    const otaceni = !rez && pripraven && !pevny;
    scena.dataset.rezim = otaceni ? "3d" : "schema";
    schema.setAttribute("aria-hidden", String(otaceni));
    model.setAttribute("aria-hidden", String(!otaceni));
    model.inert = !otaceni;
    if (otaceni) model.removeAttribute("tabindex");
    else model.setAttribute("tabindex", "-1");
    nastroje.hidden = !otaceni;
    prepnout.hidden = rez || !pripraven;
    prepnout.textContent = otaceni ? textProJazyk("Pevný pohled", "Fixed view") : textProJazyk("Otáčet ve 3D", "Rotate in 3D");
    if (rez) popis.textContent = textProJazyk("Řez ukazuje umístění techniky a vybavení napříč podlažími. Vybrané prvky se zvýrazní.", "The cross-section shows the building services on each level. Selected features are highlighted.");
    else if (otaceni) popis.textContent = textProJazyk("Tažením dům otočíte. Kolečkem nebo dvěma prsty si ho přiblížíte.", "Drag to rotate the villa. Use the scroll wheel or pinch with two fingers to zoom.");
    else if (sestava.has("markyzy") && pohled === "zahrada") popis.textContent = pripraven ? textProJazyk("Markýzy jsou vidět v otáčecím pohledu na dům.", "The awnings are visible in the rotatable view.") : textProJazyk("Markýzy jsou součástí vybrané sestavy. Pevný pohled ukazuje ostatní zakreslené prvky.", "Awnings are included in your selection. The fixed view shows the other features.");
    else if (chyba) popis.textContent = textProJazyk("V tomto prohlížeči se zobrazuje pevný pohled s vybranými doplňky.", "This browser displays the fixed view with your selected extras.");
    else popis.textContent = textProJazyk("Pevný pohled ukazuje dům s vybranými doplňky.", "The fixed view shows the villa with your selected extras.");
  }
  function pouzijSchema() {
    chyba = true;
    pripraven = false;
    zobraz();
  }
  model.addEventListener("error", pouzijSchema);
  model.addEventListener("load", () => {
    try {
      materialy = model.model.materials.filter(m => m.name.startsWith("volba|")).map(material => {
        const [, id, , kryti] = material.name.split("|");
        return { id, kryti: Number(kryti), material, barva: material.pbrMetallicRoughness.baseColorFactor.slice(0, 3) };
      });
      prepniMaterialy();
      pripraven = true;
      chyba = false;
      vratKameru(true);
      zobraz();
    } catch {
      pouzijSchema();
    }
  });
  function nacti() {
    if (nacteni) return;
    nacteni = import("./vendor/model-viewer-3.5.0.min.js").then(() => {
      model.loading = "eager";
      model.src = new URL("dum-3d/dum-b-konfigurator.glb", skriptUrl).href;
    }).catch(pouzijSchema);
  }
  window.aktualizujModelDomu = (novyPohled, vybrane) => {
    const zmenaPohledu = novyPohled !== pohled;
    pohled = novyPohled;
    sestava = new Set(vybrane);
    prepniMaterialy();
    if (zmenaPohledu) vratKameru();
    zobraz();
  };
  document.getElementById("kamera-zpet").addEventListener("click", () => vratKameru());
  prepnout.addEventListener("click", () => {
    pevny = !pevny;
    zobraz();
  });
  uzky.addEventListener("change", () => vratKameru(true));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        nacti();
        observer.disconnect();
      }
    }, { rootMargin: "500px" });
    observer.observe(scena);
  } else nacti();
})();
