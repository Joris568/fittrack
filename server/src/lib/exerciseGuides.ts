/** Short how-to guides for the common exercises, so the explanation is instant, free and works
 * without a connection. Anything not listed here (custom exercises, rarer ones) gets an
 * AI-written guide on first request, which is then cached on the exercise. */
export interface ExerciseGuide {
  muscles: { primary: string[]; secondary: string[] };
  steps: string[];
  cues: string[];
  mistakes: string[];
  tip?: string;
}

function g(
  primary: string[],
  secondary: string[],
  steps: string[],
  cues: string[],
  mistakes: string[],
  tip?: string
): ExerciseGuide {
  return { muscles: { primary, secondary }, steps, cues, mistakes, tip };
}

const BENCH = g(
  ["Borst"],
  ["Voorste schouder", "Triceps"],
  [
    "Lig met je ogen onder de stang, schouderbladen naar elkaar en naar beneden getrokken, voeten plat op de grond.",
    "Pak de stang iets breder dan schouderbreedte en til hem uit de rekken met gestrekte armen.",
    "Zak gecontroleerd naar je onderste borst (ongeveer tepelhoogte) met ellebogen ~45-60° van je lichaam.",
    "Duw de stang krachtig terug omhoog, licht richting je gezicht, tot je armen gestrekt zijn.",
  ],
  ["Houd je schouderbladen de hele set vast tegen de bank", "Duw jezelf met je voeten door de grond", "Polsen recht boven ellebogen"],
  ["Ellebogen helemaal 90° naar buiten (belast de schouders)", "Billen van de bank tillen", "Stuiteren op de borst"],
  "Ga je dicht bij falen, gebruik dan een spotter of de veiligheidspennen."
);

const INCLINE_PRESS = g(
  ["Bovenste borst"],
  ["Voorste schouder", "Triceps"],
  [
    "Zet de bank op 20-30° (hoger dan dat wordt het vooral een schouderpress).",
    "Schouderbladen samen en omlaag, voeten stevig neer, til het gewicht boven je bovenborst.",
    "Zak gecontroleerd naar je bovenste borst, ellebogen ~45-60° van je lichaam.",
    "Duw omhoog tot bijna gestrekt en houd spanning op de borst.",
  ],
  ["Lage hellingshoek (30° of minder) werkt het best voor de bovenborst", "Laat de ellebogen niet te ver naar buiten zakken"],
  ["Te steile bank waardoor de schouders het overnemen", "Gewicht te snel laten zakken"]
);

const ROW_BARBELL = g(
  ["Brede rugspier (lats)", "Bovenrug"],
  ["Achterste schouder", "Biceps", "Onderrug"],
  [
    "Sta met je voeten heupbreed, buig voorover vanuit je heupen tot je romp ruwweg 45° of lager staat, rug recht.",
    "Pak de stang iets breder dan schouderbreedte, armen gestrekt.",
    "Trek de stang richting je onderbuik en knijp je schouderbladen samen.",
    "Laat gecontroleerd zakken tot je armen weer gestrekt zijn.",
  ],
  ["Trek met je ellebogen, niet met je handen", "Houd je romp stil, geen schommelen", "Kijk schuin naar de grond, nek neutraal"],
  ["Rug rond laten gaan", "Met momentum rukken met je bovenlichaam", "Halve bewegingen zonder strekking onderin"]
);

const ROW_DUMBBELL = g(
  ["Brede rugspier (lats)", "Bovenrug"],
  ["Achterste schouder", "Biceps"],
  [
    "Zet een hand en knie op een bank, rug vlak, andere hand pakt de dumbbell met gestrekte arm.",
    "Trek de dumbbell richting je heup (niet richting je schouder) en houd je elleboog dicht bij je lichaam.",
    "Houd de top even vast en voel je lat samenknijpen.",
    "Laat langzaam zakken tot volledige strekking, laat je schouderblad mee naar voren glijden.",
  ],
  ["Denk aan je elleboog naar je heup trekken", "Bovenlichaam stil houden", "Volledige rek onderin"],
  ["Draaien met de romp om meer gewicht te halen", "Te kort bewegingsbereik"]
);

const PULLDOWN = g(
  ["Brede rugspier (lats)"],
  ["Biceps", "Achterste schouder", "Onderarm"],
  [
    "Zit met je bovenbenen vastgezet onder de pads en pak de stang iets breder dan schouderbreedte (overhands).",
    "Leun licht (ongeveer 10-20°) achterover, borst omhoog.",
    "Trek de stang naar je bovenborst door je ellebogen naar beneden en iets naar achteren te sturen.",
    "Laat de stang gecontroleerd terug omhoog tot je lats volledig gestrekt zijn.",
  ],
  ["Ellebogen omlaag en richting je heupen, niet je handen trekken", "Borst naar de stang, schouders weg van je oren", "Volledig strekken bovenin"],
  ["Achteroverleunen en naar je buik trekken (wordt een roei-beweging)", "Stang achter het hoofd langs trekken", "Schouders omhoog laten komen"],
  "Onderzoek toont dat de breedte van je grip weinig uitmaakt voor lat-activatie; kies de grip waarmee je het zwaarst en het strakst kunt trekken."
);

const SQUAT = g(
  ["Quadriceps", "Bilspieren"],
  ["Adductoren", "Onderrug", "Core"],
  [
    "Zet de stang op je bovenrug (op de spieren, niet op je nek), voeten iets breder dan schouderbreedte, tenen licht naar buiten.",
    "Adem diep in, span je core aan (alsof je een stomp verwacht) en zak door heupen en knieën tegelijk.",
    "Ga zo diep als je techniek goed blijft (minimaal heupen op kniehoogte), knieën in lijn met je tenen.",
    "Duw door je hele voet omhoog en strek heupen en knieën tegelijk.",
  ],
  ["Houd je borst omhoog en je rug neutraal", "Duw je knieën naar buiten", "Gewicht op het midden van je voet"],
  ["Knieën naar binnen laten zakken", "Hielen van de grond tillen", "Eerst met de billen omhoog komen en dan pas de borst"],
  "Heb je last van je rug of enkels? Probeer een goblet squat of hack squat."
);

const RDL = g(
  ["Hamstrings", "Bilspieren"],
  ["Onderrug", "Onderarm (grip)"],
  [
    "Sta rechtop met de stang tegen je bovenbenen, voeten heupbreed, knieën licht gebogen.",
    "Duw je billen naar achteren en laat de stang langs je benen naar beneden glijden, rug recht.",
    "Zak tot je een stevige rek voelt in je hamstrings (meestal rond kniehoogte tot halverwege het scheenbeen).",
    "Duw je heupen naar voren om weer rechtop te komen en knijp je billen bovenin samen.",
  ],
  ["Denk 'billen naar achteren', niet 'bukken'", "Stang dicht langs je benen houden", "Schouderbladen naar beneden en samen"],
  ["Rug rond laten gaan", "De stang van je benen af laten zwaaien", "Er een squat van maken door je knieën te veel te buigen"],
  "Een van de beste oefeningen om je hamstrings in gerekte positie te belasten."
);

const OHP = g(
  ["Schouders"],
  ["Triceps", "Bovenste borst", "Core"],
  [
    "Pak de stang net buiten schouderbreedte, ellebogen iets voor de stang, stang op je bovenste borst/sleutelbeen.",
    "Span je billen en core aan, kijk recht vooruit.",
    "Duw de stang recht omhoog en beweeg je hoofd licht naar achteren om ruimte te maken.",
    "Eindig met je armen gestrekt, stang boven je middenvoet, hoofd weer door het 'raam' naar voren.",
  ],
  ["Billen en buik aanspannen, niet doorhangen in je onderrug", "Stang in een rechte lijn boven je middenvoet", "Schouders niet naar je oren trekken"],
  ["Achterover leunen (holle rug)", "Pols naar achteren laten knikken", "Met je benen meehelpen (dat is een push press)"]
);

const DB_PRESS_SHOULDER = g(
  ["Schouders"],
  ["Triceps", "Bovenste borst"],
  [
    "Zit met rugleuning iets omhoog, dumbbells op schouderhoogte, ellebogen iets voor je lichaam.",
    "Duw de dumbbells omhoog tot bijna gestrekt (iets naar elkaar toe).",
    "Zak gecontroleerd tot ongeveer oorhoogte.",
  ],
  ["Houd je rug tegen de leuning, geen holle rug", "Polsen recht boven ellebogen"],
  ["Te ver achterover leunen", "Dumbbells te laag laten zakken met naar buiten gedraaide ellebogen"]
);

const LATERAL = g(
  ["Zij-deltoïde (breedte van de schouders)"],
  ["Bovenste trapezius"],
  [
    "Sta rechtop met lichte dumbbells langs je zij, kleine buiging in je ellebogen en iets voorover leunen (~10°).",
    "Til je armen zijwaarts tot ongeveer schouderhoogte, laat je ellebogen leiden (niet je handen).",
    "Houd even vast en laat langzaam zakken (2-3 seconden) zonder dat de dumbbells tegen je lichaam botsen.",
  ],
  ["Denk aan 'ellebogen naar buiten duwen', niet de dumbbell optillen", "Schouders laag houden, niet optrekken", "Strak en gecontroleerd, geen zwaai"],
  ["Te zwaar gewicht met momentum zwaaien", "Hoger dan schouderhoogte tillen met opgetrokken schouders", "Te snel laten vallen"],
  "De grootste hefboom voor bredere schouders: train ze 2-4x per week en blijf dicht bij falen. Onderzoek vindt geen groeiverschil tussen kabel en dumbbell, kies wat je het best kunt controleren."
);

const FACE_PULL = g(
  ["Achterste schouder", "Bovenrug"],
  ["Rotator cuff", "Trapezius"],
  [
    "Zet de kabel op gezichtshoogte met een touw, pak met beide handen (duimen naar je toe) en stap achteruit.",
    "Trek het touw richting je gezicht, ellebogen hoog en naar buiten, en trek de uiteinden uit elkaar.",
    "Houd even vast waar je achterste schouders knijpen en laat gecontroleerd terug.",
  ],
  ["Ellebogen hoog en buiten", "Trek het touw naar je gezicht, niet naar je borst", "Licht gewicht, hoge kwaliteit"],
  ["Te zwaar waardoor je achterover leunt", "Ellebogen laag laten zakken"]
);

const CURL = g(
  ["Biceps"],
  ["Onderarm"],
  [
    "Sta rechtop, ellebogen langs je lichaam, pak het gewicht onderhands.",
    "Buig je ellebogen en til het gewicht omhoog zonder je ellebogen naar voren te laten gaan.",
    "Knijp bovenin, laat in 2-3 seconden gecontroleerd zakken tot de armen gestrekt zijn.",
  ],
  ["Ellebogen blijven langs je zij", "Langzaam laten zakken, de rek telt mee", "Schouders stil"],
  ["Met je rug zwaaien om omhoog te komen", "Ellebogen naar voren laten schuiven", "Niet volledig strekken onderin"]
);

const TRICEPS_PUSHDOWN = g(
  ["Triceps"],
  [],
  [
    "Sta dicht bij de kabel, ellebogen langs je zij en vastgezet, pak stang of touw bovenhands.",
    "Duw naar beneden tot je armen volledig gestrekt zijn en knijp je triceps.",
    "Laat gecontroleerd terug tot ongeveer 90° in je ellebogen.",
  ],
  ["Alleen je onderarmen bewegen", "Ellebogen blijven op dezelfde plek", "Volledig strekken onderin"],
  ["Ellebogen laten wegzwaaien", "Met je bovenlichaam meepersen"]
);

const OVERHEAD_TRI = g(
  ["Triceps (lange kop)"],
  [],
  [
    "Houd een dumbbell met beide handen boven je hoofd, of gebruik een touw aan een kabel.",
    "Buig je ellebogen en laat het gewicht achter je hoofd zakken tot een diepe rek in je triceps.",
    "Strek je armen weer volledig, ellebogen wijzen naar voren.",
  ],
  ["Ellebogen dicht bij je hoofd houden", "Diepe rek onderin", "Core aanspannen zodat je onderrug niet doorhangt"],
  ["Ellebogen naar buiten laten klappen", "Te zwaar waardoor je rug doorhangt"],
  "Deze variant traint de lange kop van je triceps in gerekte positie, goed voor armdikte."
);

const PLANK = g(
  ["Core"],
  ["Schouders", "Bilspieren"],
  [
    "Steun op je onderarmen en tenen, ellebogen onder je schouders.",
    "Span je billen en buik aan zodat je lichaam één rechte lijn vormt.",
    "Houd de positie en adem rustig door.",
  ],
  ["Billen licht aanspannen", "Duw je onderarmen in de grond", "Kijk naar de grond"],
  ["Door je onderrug zakken", "Billen te hoog in de lucht"]
);

const LEG_PRESS = g(
  ["Quadriceps", "Bilspieren"],
  ["Hamstrings", "Adductoren"],
  [
    "Zit met je rug en billen tegen de leuning, voeten midden op het platform, ongeveer schouderbreed.",
    "Haal de veiligheidspennen weg en laat het platform zakken tot je knieën ~90° of dieper (zolang je onderrug op de leuning blijft).",
    "Duw door je hele voet omhoog zonder je knieën volledig te slotten.",
  ],
  ["Onderrug blijft tegen de leuning", "Knieën in lijn met je tenen", "Niet op slot duwen bovenin"],
  ["Billen van de zitting laten komen onderin", "Knieën naar binnen laten zakken", "Halve herhalingen met te veel gewicht"]
);

const HIP_THRUST = g(
  ["Bilspieren"],
  ["Hamstrings", "Core"],
  [
    "Zit met je bovenrug tegen een bank en de stang over je heupen (met pad), voeten heupbreed.",
    "Duw door je hielen en til je heupen tot je bovenlichaam en bovenbenen één lijn vormen.",
    "Knijp je billen hard samen bovenin en laat gecontroleerd zakken.",
  ],
  ["Kin op je borst, kijk naar voren", "Ribben omlaag, niet in je onderrug doorbuigen", "Schenen verticaal bovenin"],
  ["Overstrekken in je onderrug", "Voeten te ver of te dichtbij waardoor je hamstrings het overnemen"]
);

const LUNGE = g(
  ["Quadriceps", "Bilspieren"],
  ["Hamstrings", "Core"],
  [
    "Neem een lange stap naar voren (of sta met je achterste voet op een bank bij een Bulgarian split squat).",
    "Zak recht naar beneden tot je voorste bovenbeen ongeveer horizontaal is, achterste knie dicht bij de grond.",
    "Duw door je voorste voet omhoog.",
  ],
  ["Romp rechtop of licht voorover voor meer bilspieren", "Voorste knie in lijn met je tenen", "Gewicht op de voorste voet"],
  ["Te korte pas waardoor je knie te ver voorbij je tenen gaat", "Balans verliezen door te smalle stand"]
);

const EXT_CURL_LEG = g(
  ["Quadriceps"],
  [],
  ["Stel de machine zo af dat je knie bij de as van de machine zit en het kussen op je onderbeen rust.", "Strek je benen volledig en knijp bovenin.", "Laat langzaam zakken tot ongeveer 90°."],
  ["Gecontroleerd tempo", "Knijp bovenin even"],
  ["Gewicht omhoog zwaaien", "Heupen van de zitting tillen"]
);

const HAM_CURL = g(
  ["Hamstrings"],
  ["Kuiten"],
  ["Stel de machine af zodat het kussen vlak boven je hielen ligt en je knieën bij de as zitten.", "Buig je benen zo ver mogelijk en knijp onderaan.", "Laat langzaam terugzakken tot gestrekt."],
  ["Heupen vast op de zitting/bank houden", "Langzaam laten zakken (rek is belangrijk)"],
  ["Heupen omhoog laten komen om gewicht te forceren", "Te snel laten vallen"]
);

const CALF = g(
  ["Kuiten"],
  [],
  ["Sta met de bal van je voet op de rand, hielen vrij.", "Zak diep tot je kuiten gerekt zijn, pauzeer even.", "Duw zo hoog mogelijk omhoog op je tenen en knijp bovenin."],
  ["Volledig bereik, diep rekken onderin", "Pauzeer 1 seconde onderin en bovenin"],
  ["Stuiteren zonder volledige rek", "Te kort bewegingsbereik"],
  "Kuiten reageren goed op volle rek, pauzes en 10-15 reps."
);

const FLY = g(
  ["Borst"],
  ["Voorste schouder"],
  [
    "Lig op de bank met de dumbbells boven je borst, ellebogen licht gebogen.",
    "Open je armen in een boog tot je een rek in je borst voelt (niet dieper dan schouderhoogte).",
    "Breng ze weer samen in dezelfde boog en knijp je borst samen.",
  ],
  ["Denk aan een grote omhelzing", "Ellebogen blijven licht gebogen en vast", "Rek in de borst is het doel"],
  ["Armen strekken en buigen (wordt een press)", "Te diep zakken met pijn in je schouders"]
);

const CABLE_FLY = g(
  ["Borst"],
  ["Voorste schouder"],
  ["Zet de kabels op de gewenste hoogte, pak de handvaten en sta met één voet iets voor.", "Trek je armen in een boog naar elkaar toe voor je borst.", "Laat gecontroleerd terug tot een rek in je borst."],
  ["Constante spanning op de borst", "Romp licht voorover, stabiel"],
  ["Met je schouders mee naar voren rollen", "Te zwaar waardoor je met je lichaam meeswingt"]
);

const PUSHUP = g(
  ["Borst"],
  ["Triceps", "Voorste schouder", "Core"],
  [
    "Plaats je handen iets breder dan schouderbreedte, lichaam in één lijn van hoofd tot hielen.",
    "Zak met je borst naar de grond, ellebogen ~45° van je lichaam.",
    "Duw jezelf weer omhoog tot de armen gestrekt zijn.",
  ],
  ["Billen en buik aanspannen", "Borst raakt bijna de grond"],
  ["Onderrug laten doorzakken", "Alleen je hoofd laten zakken"]
);

const PULLUP = g(
  ["Brede rugspier (lats)"],
  ["Biceps", "Onderarm", "Bovenrug"],
  [
    "Pak de stang iets breder dan schouderbreedte, hang met gestrekte armen en span je schouderbladen licht aan.",
    "Trek jezelf omhoog tot je kin boven de stang komt, ellebogen naar beneden en achter je.",
    "Laat gecontroleerd zakken tot volledig gestrekt.",
  ],
  ["Ellebogen naar je heupen sturen", "Borst naar de stang", "Volledige hang onderin"],
  ["Zwaaien/kippen", "Halve herhalingen", "Schouders naar je oren"],
  "Lukt het nog niet? Gebruik een elastiek of de assisted-machine, of doe negatieve herhalingen."
);

const CABLE_ROW = g(
  ["Brede rugspier (lats)", "Bovenrug"],
  ["Achterste schouder", "Biceps"],
  ["Zit met licht gebogen knieën en rechte rug, pak het handvat.", "Trek het handvat naar je onderbuik en knijp je schouderbladen samen.", "Laat gecontroleerd terug en rek je lats volledig."],
  ["Borst omhoog, rug neutraal", "Ellebogen langs het lichaam", "Volledige strekking naar voren"],
  ["Heen en weer zwaaien met je romp", "Schouders optrekken"]
);

const DEADLIFT = g(
  ["Hamstrings", "Bilspieren", "Onderrug"],
  ["Bovenrug", "Quadriceps", "Onderarm (grip)"],
  [
    "Sta met de stang boven je middenvoet, voeten heupbreed. Buig voorover en pak de stang net buiten je benen.",
    "Zet je borst omhoog, span je lats aan ('buig de stang om je benen') en span je core aan.",
    "Duw door de grond en strek je heupen en knieën tegelijk, stang blijft dicht langs je benen.",
    "Sta rechtop met geklemde billen en zet de stang gecontroleerd terug.",
  ],
  ["Duw de vloer weg in plaats van de stang op te trekken", "Stang schraapt langs je benen", "Neutrale rug"],
  ["Rug rond laten gaan", "Stang naar voren laten zwaaien", "Heupen te vroeg omhoog schieten"]
);

const SHRUG = g(
  ["Bovenste trapezius"],
  ["Onderarm"],
  ["Sta met zware dumbbells of stang langs je benen.", "Trek je schouders recht omhoog richting je oren en pauzeer even.", "Laat gecontroleerd zakken."],
  ["Recht omhoog, niet rollen", "Pauze bovenin"],
  ["Schouders rond laten draaien", "Hoofd naar voren steken"]
);

const HACK = g(
  ["Quadriceps"],
  ["Bilspieren"],
  ["Plaats je voeten laag/middelmatig op het platform, rug en schouders tegen de pad.", "Zak diep tot je knieën ruim voorbij 90° (zolang je rug blijft liggen).", "Duw omhoog zonder je knieën op slot te zetten."],
  ["Hielen blijven op het platform", "Knieën in lijn met je tenen"],
  ["Hielen laten loskomen", "Te weinig diepte"]
);

const GOBLET = g(
  ["Quadriceps", "Bilspieren"],
  ["Core"],
  ["Houd een dumbbell of kettlebell tegen je borst, voeten iets breder dan schouderbreedte.", "Zak diep tussen je knieën met een rechte romp.", "Duw omhoog door je voeten."],
  ["Borst omhoog, ellebogen tussen de knieën", "Knieën naar buiten duwen"],
  ["Voorover vallen", "Hielen van de grond"]
);

const CLOSE_GRIP = g(
  ["Triceps"],
  ["Borst", "Voorste schouder"],
  ["Lig als bij bankdrukken maar pak de stang op ongeveer schouderbreedte.", "Zak met ellebogen dicht langs je lichaam naar je onderste borst.", "Duw omhoog en strek je triceps."],
  ["Ellebogen langs het lichaam", "Pols recht"],
  ["Te smalle grip (belast je polsen)", "Ellebogen wijd laten wegklappen"]
);

const SKULL = g(
  ["Triceps"],
  [],
  ["Lig op een bank met een EZ-bar of dumbbells boven je borst, armen gestrekt.", "Buig alleen je ellebogen en zak richting je voorhoofd of net achter je hoofd.", "Strek je armen weer volledig."],
  ["Bovenarmen blijven verticaal", "Lichte gewichten, volledige rek"],
  ["Ellebogen naar buiten laten klappen", "Gewicht naar de neus laten gaan met zwaaiende armen"]
);

const HANGING_LEG = g(
  ["Onderste buikspieren", "Heupbuigers"],
  ["Onderarm (grip)"],
  ["Hang aan een stang met gestrekte armen.", "Til je benen (gestrekt of gebogen) omhoog door je bekken naar je borst te kantelen.", "Laat gecontroleerd zakken zonder te zwaaien."],
  ["Kantel je bekken, til niet alleen je benen", "Geen momentum"],
  ["Heen en weer zwaaien", "Alleen met je heupbuigers tillen"]
);

const CABLE_CRUNCH = g(
  ["Buikspieren"],
  [],
  ["Kniel onder een hoge kabel met touw bij je hoofd.", "Rol je romp naar beneden door je ribben richting je heupen te brengen.", "Keer gecontroleerd terug."],
  ["Beweeg door je ruggengraat te buigen, niet door je heupen", "Houd je heupen stil"],
  ["Gewoon met je heupen naar achteren zakken", "Te zwaar waardoor je rug het overneemt"]
);


const DB_BENCH = g(
  ["Borst"],
  ["Voorste schouder", "Triceps"],
  [
    "Ga op de bank zitten met de dumbbells op je knieën en laat jezelf achterover zakken terwijl je ze naar je borst brengt.",
    "Schouderbladen samen en omlaag, voeten stevig neer, dumbbells boven je borst met gestrekte armen.",
    "Zak gecontroleerd tot je ellebogen ongeveer 45-60° van je lichaam zijn en je een rek in je borst voelt.",
    "Duw de dumbbells omhoog en iets naar elkaar toe.",
  ],
  ["Schouderbladen blijven vast tegen de bank", "Polsen recht boven ellebogen", "Volledige rek onderin"],
  ["Ellebogen helemaal naar buiten laten zakken", "Dumbbells botsen bovenin en je verliest spanning"],
  "Dumbbells geven meer bereik dan een stang en maken verschillen tussen links en rechts zichtbaar."
);

const MACHINE_CHEST = g(
  ["Borst"],
  ["Voorste schouder", "Triceps"],
  [
    "Stel de zitting zo af dat de handvaten op borsthoogte zijn en druk je schouderbladen tegen de rugleuning.",
    "Duw de handvaten naar voren tot bijna gestrekt.",
    "Laat gecontroleerd terug tot je een rek in je borst voelt, zonder dat je schouders naar voren rollen.",
  ],
  ["Schouders laag en achter", "Gecontroleerd tempo", "Knijp je borst bovenin"],
  ["Zitting te laag of te hoog afgesteld", "Schouders naar voren laten rollen"]
);

const DIPS = g(
  ["Borst", "Triceps"],
  ["Voorste schouder"],
  [
    "Steun op de dip-stangen met gestrekte armen, schouders laag.",
    "Voor meer borst: leun iets voorover. Voor meer triceps: blijf rechter staan.",
    "Zak tot je bovenarmen ongeveer horizontaal zijn of je een rek in je borst voelt.",
    "Duw jezelf weer omhoog tot gestrekt.",
  ],
  ["Schouders niet naar je oren trekken", "Ellebogen naar achteren, niet wijd naar buiten", "Gecontroleerd zakken"],
  ["Te diep zakken met pijn voorin de schouder", "Zwaaien met je benen"],
  "Voel je pijn in je schouders? Vervang door push-ups of een chest press."
);

const STRAIGHT_ARM = g(
  ["Brede rugspier (lats)"],
  ["Triceps (lange kop)", "Core"],
  [
    "Sta voor een hoge kabel met een rechte stang of touw, leun licht voorover en pak met gestrekte armen.",
    "Duw de stang in een boog naar beneden tot voor je bovenbenen, armen bijna gestrekt.",
    "Laat gecontroleerd terug omhoog tot je lats gerekt zijn.",
  ],
  ["Armen vrijwel gestrekt houden", "Voel je lats werken, niet je triceps", "Rustig tempo"],
  ["Armen buigen en uitduwen als een triceps pushdown", "Met je romp meepersen"]
);

const REVERSE_FLY = g(
  ["Achterste schouder"],
  ["Bovenrug", "Trapezius"],
  [
    "Buig voorover (of zit voorover op een bank / gebruik de reverse pec-deck), dumbbells hangen onder je schouders.",
    "Open je armen zijwaarts met licht gebogen ellebogen tot ongeveer schouderhoogte.",
    "Knijp je achterste schouders en laat langzaam terugzakken.",
  ],
  ["Denk 'ellebogen naar buiten', niet 'handen ophalen'", "Licht gewicht, strak tempo", "Nek neutraal"],
  ["Met je rug meezwaaien", "Te zwaar waardoor je trapezius het overneemt"]
);

const FLY_MACHINE = g(
  ["Borst"],
  ["Voorste schouder"],
  [
    "Stel de zitting af zodat de handvaten op borsthoogte zijn en zit met je rug tegen de leuning.",
    "Breng de armen in een boog naar elkaar toe en knijp je borst.",
    "Laat gecontroleerd terug tot een rek in je borst, zonder je schouders naar voren te laten rollen.",
  ],
  ["Schouders laag en achter", "Rustig tempo en volle rek"],
  ["Met je schouders meebewegen", "Te weinig bewegingsbereik"]
);

const GUIDES: Record<string, ExerciseGuide> = {
  Bankdrukken: BENCH,
  "Schuine bankdrukken": INCLINE_PRESS,
  "Decline bankdrukken": BENCH,
  "Dumbbell press": DB_BENCH,
  "Schuine dumbbell press": INCLINE_PRESS,
  "Dumbbell fly": FLY,
  "Chest press machine": MACHINE_CHEST,
  "Pec deck": FLY_MACHINE,
  "Chest fly (kabel)": CABLE_FLY,
  "Cable crossover": CABLE_FLY,
  "Push-up": PUSHUP,
  "Dips (borst)": DIPS,
  Deadlift: DEADLIFT,
  "Sumo deadlift": DEADLIFT,
  "Bent-over row": ROW_BARBELL,
  "Pendlay row": ROW_BARBELL,
  "T-bar row": ROW_BARBELL,
  "Dumbbell row": ROW_DUMBBELL,
  "Chest-supported row": ROW_DUMBBELL,
  Optrekken: PULLUP,
  "Optrekken (ondergrepen)": PULLUP,
  "Lat pulldown": PULLDOWN,
  "Lat pulldown (nauwe grip)": PULLDOWN,
  "Kabelroeien zittend": CABLE_ROW,
  "Straight-arm pulldown": STRAIGHT_ARM,
  Roeimachine: CABLE_ROW,
  Shrugs: SHRUG,
  Squat: SQUAT,
  "Front squat": SQUAT,
  "Hack squat": HACK,
  "Goblet squat": GOBLET,
  "Bulgarian split squat": LUNGE,
  Lunges: LUNGE,
  "Walking lunges": LUNGE,
  Beenpers: LEG_PRESS,
  "Romanian deadlift": RDL,
  "Stijfbeen deadlift (dumbbell)": RDL,
  Beenstrekker: EXT_CURL_LEG,
  "Beenbuiger zittend": HAM_CURL,
  "Beenbuiger liggend": HAM_CURL,
  "Hip thrust": HIP_THRUST,
  "Glute bridge": HIP_THRUST,
  "Kuitheffen staand": CALF,
  "Kuitheffen zittend": CALF,
  "Kuitheffen (leg press)": CALF,
  "Overhead press": OHP,
  "Push press": OHP,
  "Dumbbell shoulder press": DB_PRESS_SHOULDER,
  "Arnold press": DB_PRESS_SHOULDER,
  "Shoulder press machine": DB_PRESS_SHOULDER,
  "Lateral raise": LATERAL,
  "Lateral raise (kabel)": LATERAL,
  "Reverse fly": REVERSE_FLY,
  "Reverse pec deck": REVERSE_FLY,
  "Face pull": FACE_PULL,
  "Barbell curl": CURL,
  "EZ-bar curl": CURL,
  "Dumbbell curl": CURL,
  "Hammer curl": CURL,
  "Concentratie curl": CURL,
  "Preacher curl": CURL,
  "Kabel curl": CURL,
  "Triceps pushdown": TRICEPS_PUSHDOWN,
  "Triceps pushdown (touw)": TRICEPS_PUSHDOWN,
  "Overhead triceps extension": OVERHEAD_TRI,
  "Skull crusher": SKULL,
  "Close-grip bankdrukken": CLOSE_GRIP,
  "Dips (triceps)": DIPS,
  Plank: PLANK,
  Zijplank: PLANK,
  "Hanging leg raise": HANGING_LEG,
  "Cable crunch": CABLE_CRUNCH,
};

export function staticGuideFor(exerciseName: string): ExerciseGuide | null {
  return GUIDES[exerciseName] ?? null;
}

export function youtubeSearchUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} uitvoering techniek`)}`;
}
