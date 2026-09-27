# SLS Marktkarte – Datenarchitektur

## Ziel
Die Marktkarte darf keine scheinpräzisen Werte aus wenigen oder ungeeigneten Fällen erzeugen. Deshalb werden Datenquellen getrennt geführt und erst nach klaren Qualitätsregeln für die öffentliche Anzeige freigegeben.

## Propstack-Felder
Für die Pilotstädte Dorsten, Recklinghausen, Essen und Dortmund werden zunächst folgende Felder genutzt:

- id / property_id
- city
- zip_code
- district / Bezirk / Geolage, sofern vorhanden
- lat / lng
- marketing_type
- rs_type
- rs_category
- construction_year
- living_space
- price / object_price
- price_per_sqm
- sold_price
- sold_date
- property_status / status
- Custom Fields später nur nach expliziter Feldzuordnung

## Preislogik
1. Verkaufspreise (sold_price) werden bevorzugt.
2. Verkaufspreis je m² = sold_price / living_space.
3. Angebotspreise werden separat behandelt.
4. Verkaufspreise und Angebotspreise werden niemals in einen gemeinsamen Mittelwert gemischt.
5. Preisband = 25%- bis 75%-Quantil.
6. Typischer Wert = Median.
7. Ausreißerfilter vorerst: 250 bis 20.000 €/m²; später objekttyp- und regionsspezifisch.

## Qualitätsstufen
- high: mindestens 15 belastbare Verkaufspreise
- medium: mindestens 5 belastbare Verkaufspreise
- insufficient: weniger als 5 Verkaufspreise; keine öffentliche Verkaufspreis-Aussage
- asking: Angebotsmarkt-Indikation, klar als solche gekennzeichnet

## Geografische Hierarchie
Bundesland -> Region -> Stadt -> Stadtteil -> Mikrolage.

## Objektarten
Phase 1:
- Eigentumswohnung: rs_type=APARTMENT
- Haus: rs_type=HOUSE

Später:
- Unterteilung über rs_category
- Baujahrescluster
- Zustand/Energieeffizienz
- vermietet/frei

## API
Vercel Endpoint: /api/market-data?city=Dorsten&type=wohnung

Benötigte Vercel-Umgebungsvariable:
PROPSTACK_API_KEY

Der Schlüssel darf niemals in index.html, im GitHub-Repository oder im Browser-JavaScript gespeichert werden.

## Nächste technische Stufe
Nach Setzen von PROPSTACK_API_KEY:
1. tatsächliche Antwortstruktur des SLS-Accounts verifizieren,
2. SLS-Status "erfolgreich vermarktet" identifizieren,
3. prüfen, ob sold_price auf Objekten oder Deals gepflegt wird,
4. Geolage/Stadtteil-Feld eindeutig mappen,
5. echte Pilotstatistik für Dorsten, Recklinghausen, Essen und Dortmund erzeugen.
