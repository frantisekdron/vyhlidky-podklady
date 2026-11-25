(() => {
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
    prepnout.textContent = otaceni ? "Pevný pohled" : "Otáčet ve 3D";
    if (rez) popis.textContent = "Řez ukazuje umístění techniky a vybavení napříč podlažími. Vybrané prvky se zvýrazní.";
    else if (otaceni) popis.textContent = "Tažením dům otočíte. Kolečkem nebo dvěma prsty si ho přiblížíte.";
    else if (sestava.has("markyzy") && pohled === "zahrada") popis.textContent = pripraven ? "Markýzy jsou vidět v otáčecím pohledu na dům." : "Markýzy jsou součástí vybrané sestavy. Pevný pohled ukazuje ostatní zakreslené prvky.";
    else if (chyba) popis.textContent = "V tomto prohlížeči se zobrazuje pevný pohled s vybranými doplňky.";
    else popis.textContent = "Pevný pohled ukazuje dům s vybranými doplňky.";
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
      model.src = "assets/dum-3d/dum-b-konfigurator.glb";
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
