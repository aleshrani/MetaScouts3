# Evoluční redesign návrh pro MetaScouts3

## 1) Rychlá analýza současné aplikace

Aplikace je jednookenní task manager se dvěma rolemi (`worker`/`boss`), sdílenými daty přes Supabase a jasně daným workflow:
- pracovník zakládá/aktualizuje úkoly,
- šéf schvaluje úkoly,
- schválení automaticky nastavuje stav `hotovo`.

Tento princip je dobře čitelný v kódu a **má zůstat zachovaný**.

### Co už dnes funguje dobře
- Přehledná role-based vrstva (worker vs boss mód).
- Silná vizuální signalizace stavů (barvy, badge, čipy).
- Praktické mikrointerakce (toasty, expand řádku, hover affordance, loading stavy).
- Dobře navržená diagnostika DB chyb.
- Nízká komplexita datového modelu (přehlednost + snadná údržba).

### Hlavní UX/UI limity
- Jeden velký `App.jsx` (nižší konzistence komponent, těžší škálování design systému).
- Místy vysoká vizuální hustota (hodně badge/chip elementů vedle sebe).
- Informační hierarchie je funkční, ale ne vždy prioritizuje „co mám udělat teď“.
- Chybí explicitní „design tokens“ (společné spacing/typografie/radius/kontrast standardy).
- Na mobilech může být top bar i task row opticky přehlcená.

---

## 2) Návrhy změn (evoluce, bez změny logiky)

> Každá větší změna je označena jako **Volitelné**. Všechny návrhy zachovávají stávající business logiku i hlavní flow.

### Návrh 1: Zavést lehký design token layer (barvy, spacing, radius, shadow)
- **Popis změny:** Sjednotit opakující se Tailwind utility do tokenů (např. přes konstanty / class mapu / drobné utility komponenty).
- **Důvod:** Dnes jsou styly funkční, ale distribuované napříč kódem; hůře se drží konzistence.
- **Očekávaný přínos:** Konzistentnější vzhled, rychlejší budoucí UI iterace, méně vizuálních odchylek.
- **Náročnost implementace:** Střední.
- **Riziko dopadu:** Nízké (bez zásahu do dat/flow).
- **Volitelné:** Ne.

### Návrh 2: Zlepšit informační hierarchii v task řádku (priorita > název > deadline > status)
- **Popis změny:** Přeskupit vizuální důrazy, aby primární text (název) měl konzistentně nejvyšší dominanci, sekundární metadata byla subtilnější.
- **Důvod:** Řádek má hodně prvků stejné „síly“, oko se hůře orientuje.
- **Očekávaný přínos:** Rychlejší skenování seznamu, menší kognitivní zátěž.
- **Náročnost implementace:** Nízká až střední.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 3: Sjednotit vertikální rytmus (8px grid) a mezery uvnitř karet
- **Popis změny:** Sjednotit `gap/padding/margin` hodnoty na pevný rytmus (4/8/12/16/24), zejména v Add panelu, detailu úkolu a filtrech.
- **Důvod:** Místy působí layout „lehce roztřeseně“ kvůli různým mikro-mezerám.
- **Očekávaný přínos:** Čistší layout, profesionálnější dojem.
- **Náročnost implementace:** Nízká.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 4: Typografická škála a kontrastní pravidla
- **Popis změny:** Definovat pevné role textu (headline, section, body, meta, caption) a minimální kontrast pro sekundární texty.
- **Důvod:** Některé sekundární texty (šedé odstíny) mohou být na slabších displejích hůře čitelné.
- **Očekávaný přínos:** Lepší čitelnost, přístupnost, vizuální profesionalita.
- **Náročnost implementace:** Nízká.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 5: Modernizace ovládacích prvků (sjednocené button/chip/input varianty)
- **Popis změny:** Vytvořit malé sdílené UI primitives (`Button`, `Chip`, `FieldLabel`, `Surface`) a používat je napříč aplikací.
- **Důvod:** Komponenty jsou dnes kvalitní, ale ne vždy stylisticky sjednocené.
- **Očekávaný přínos:** Vyšší konzistence, rychlejší údržba, jednodušší škálování.
- **Náročnost implementace:** Střední.
- **Riziko dopadu:** Nízké až střední (UI regresní riziko).
- **Volitelné:** **Ano (Volitelné).**

### Návrh 6: Header „action zoning“ (vpravo akce, vlevo kontext)
- **Popis změny:** V headeru oddělit informační část (název, datum, metriky) od akční části (CSV, Sdílet, Role).
- **Důvod:** Nyní je horní lišta bohatá, ale místy opticky přeplněná.
- **Očekávaný přínos:** Lepší orientace a rychlejší nalezení klíčových akcí.
- **Náročnost implementace:** Nízká až střední.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 7: Přístupnost a focus stavy (keyboard-first polish)
- **Popis změny:** Doplnit jednotné `focus-visible` ringy, aria popisky, lepší hit area (min 40px) u malých ikon.
- **Důvod:** Mikroovládání (mazání příloh, malé ikony) může být hůře trefitelné.
- **Očekávaný přínos:** Lepší použitelnost na mobilu i klávesnici, vyšší inkluze.
- **Náročnost implementace:** Nízká až střední.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 8: Mikrointerakce 2.0 (jemnější, konzistentní animace)
- **Popis změny:** Ucelit duration/easing (např. 120ms/180ms/240ms), přidat jemné state transitions u dropdownů, hover/focus stínů a expand panelu.
- **Důvod:** Animace existují, ale nejsou plně systematické.
- **Očekávaný přínos:** „Prémiovější“ pocit bez změny toku práce.
- **Náročnost implementace:** Nízká.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

### Návrh 9: Mobile-first compact režim seznamu
- **Popis změny:** Pro malé displeje skrýt méně důležité metriky do sekundární vrstvy (detail), zachovat však všechny akce.
- **Důvod:** Na mobilu hrozí přehlcení řádku.
- **Očekávaný přínos:** Lepší čitelnost a ovladatelnost jednou rukou.
- **Náročnost implementace:** Střední.
- **Riziko dopadu:** Střední (potřeba otestovat, že nic „nezmizí“ funkčně).
- **Volitelné:** **Ano (Volitelné).**

### Návrh 10: Kontextové onboarding hinty (jen poprvé)
- **Popis změny:** Přidat nenásilné inline hinty pro klíčové momenty (role switch, schválení, příloha), které po prvním použití zmizí.
- **Důvod:** Aplikace je intuitivní, ale nové uživatele může mást role switching.
- **Očekávaný přínos:** Rychlejší adaptace bez zásahu do workflow.
- **Náročnost implementace:** Střední.
- **Riziko dopadu:** Nízké až střední.
- **Volitelné:** **Ano (Volitelné).**

### Návrh 11: Restructuring kódu na UI sekce bez změny chování
- **Popis změny:** Rozdělit `App.jsx` na menší soubory (`components/*`, `ui/*`, `utils/*`) při zachování stejné logiky.
- **Důvod:** Monolitický soubor zvyšuje riziko chyb při budoucích změnách UI.
- **Očekávaný přínos:** Lepší maintainability, snazší redesign iterace.
- **Náročnost implementace:** Střední až vyšší.
- **Riziko dopadu:** Střední (nutnost regresního testu).
- **Volitelné:** **Ano (Volitelné).**

### Návrh 12: Semantické stavové bannery a „next best action“
- **Popis změny:** Upřesnit texty bannerů podle role + počtu úkolů a nabídnout vždy jednu jasnou další akci.
- **Důvod:** Informačně bohaté, ale ne vždy explicitně akční.
- **Očekávaný přínos:** Vyšší produktivita a jistota uživatele.
- **Náročnost implementace:** Nízká.
- **Riziko dopadu:** Nízké.
- **Volitelné:** Ne.

---

## 3) Top 10 doporučených změn

1. Design token layer (barvy/spacing/radius/shadow).
2. Informační hierarchie task řádku.
3. Sjednocený vertikální rytmus (8px grid).
4. Typografická škála + kontrastní pravidla.
5. Header action zoning.
6. Přístupnost: focus stavy, hit area, aria.
7. Konzistentní mikrointerakce.
8. Semantické bannery s „next best action“.
9. UI primitives (`Button/Chip/Surface`) — **Volitelné**.
10. Mobile compact režim — **Volitelné**.

---

## 4) Rozdělení podle rizika

### Low-risk
- Návrh 2 (hierarchie řádku)
- Návrh 3 (spacing rytmus)
- Návrh 4 (typografie/kontrast)
- Návrh 6 (header zoning)
- Návrh 8 (mikrointerakce)
- Návrh 12 (akčnější bannery)

### Medium-risk
- Návrh 1 (design token layer)
- Návrh 7 (a11y + focus + hit area)
- Návrh 10 (onboarding hinty) — **Volitelné**
- Návrh 9 (mobile compact) — **Volitelné**

### Higher-risk
- Návrh 11 (strukturální rozdělení souborů) — **Volitelné**
- Návrh 5 (UI primitives refactor ve velkém) — **Volitelné**

---

## 5) Co udělat hned vs. později

### Udělat hned (1–2 sprinty)
- Návrh 2, 3, 4, 6, 8, 12.
- Dále postupně 1 a 7.

### Udělat později (po stabilizaci)
- Návrh 5 (**Volitelné**) a 9 (**Volitelné**) po ověření mobile usage dat.
- Návrh 10 (**Volitelné**) pokud onboarding data ukážou potřebu.
- Návrh 11 (**Volitelné**) až při větší redesign iteraci.

---

## 6) Shrnutí

Doporučený směr je **evoluční redesign**: žádný zásah do business logiky, žádné bourání hlavních flow, ale systematické zvýšení vizuální kvality, konzistence a čitelnosti. Největší rychlý efekt přinese sjednocení hierarchie, spacingu, typografie a headeru; největší dlouhodobý efekt pak tokenizace stylů a postupná komponentizace UI.
