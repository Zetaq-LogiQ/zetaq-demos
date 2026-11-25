/* Solar System Explorer — body data.
   Units: km, kg, days, kelvin, degrees. Orbital elements: JPL "approximate positions of the planets"
   (J2000 ecliptic, valid 1800–2050). Physical data: NASA planetary fact sheets / IAU WGCCRE.
   Density, surface gravity and escape velocity are NOT stored: the ship scanner derives them
   from mass and radius, so the numbers are always self-consistent. */
(function () {
  'use strict';
  const AU = 149597870.7;
  const G = 6.6743e-20; // km^3 kg^-1 s^-2

  // ---------- shared surface-material sets (approx. weight % — from sample, lander and spectral data)
  const ICE_SAT = [
    { n: 'Water-ice regolith', c: '#9fd8ff', w: 6, comp: [['H₂O ice', 97.5], ['CO₂ ice', 1], ['Silicate dust', 1], ['Organics', 0.5]], note: 'Crystalline water ice gardened by micrometeorites.' },
    { n: 'Dark non-ice lag', c: '#b98a5a', w: 2, comp: [['H₂O ice', 78], ['Carbonaceous organics', 12], ['Silicates', 8], ['Nanophase iron', 2]], note: 'Ice darkened by infalling dust and radiolysis.' },
    { n: 'Fresh crater ejecta', c: '#e8f6ff', w: 2, comp: [['H₂O ice', 99.3], ['CO₂ ice', 0.5], ['NH₃ hydrate', 0.2]], note: 'Clean ice excavated from below the surface.' }
  ];
  const ICE_URA = [
    { n: 'Dirty water ice', c: '#8fc6e8', w: 5, comp: [['H₂O ice', 52], ['Hydrated silicates', 28], ['Carbonaceous organics', 15], ['CO₂ ice', 3], ['NH₃ hydrates', 2]], note: 'Roughly half ice, half rock — typical of the Uranian moons.' },
    { n: 'Carbon-rich dark mantle', c: '#7a6a5e', w: 3, comp: [['Carbonaceous organics', 40], ['H₂O ice', 35], ['Silicates', 22], ['CO₂ ice', 3]], note: 'Radiation-darkened methane residue.' },
    { n: 'Bright frost deposit', c: '#f0f6ff', w: 2, comp: [['H₂O ice', 86], ['CO₂ ice', 9], ['NH₃ hydrates', 4], ['Silicates', 1]], note: 'Volatile frost on crater floors and scarps.' }
  ];
  const CARBON = [
    { n: 'Carbonaceous regolith', c: '#8d7f73', w: 6, comp: [['SiO₂', 33], ['FeO', 24], ['MgO', 22], ['S', 4], ['Bound H₂O', 9], ['C', 3], ['Al₂O₃', 2.5], ['CaO', 2.5]], note: 'Inferred from spectra (D-type asteroid-like). No samples returned yet.' },
    { n: 'Phyllosilicate-rich fines', c: '#b8a07e', w: 3, comp: [['Mg-phyllosilicates', 55], ['Olivine', 18], ['Pyroxene', 12], ['Magnetite', 8], ['Organics', 4], ['Sulfides', 3]], note: 'Fine dust blanket, metres deep.' },
    { n: 'Impact-melt breccia', c: '#5f6a7a', w: 1, comp: [['Silicate glass', 60], ['Olivine', 20], ['Fe-Ni metal', 6], ['Troilite', 6], ['C', 3], ['Other', 5]], note: 'Shock-welded fragments around craters.' }
  ];
  const KBO = [
    { n: 'Methane ice', c: '#f2d9c4', w: 6, comp: [['CH₄ ice', 82], ['N₂ ice', 10], ['C₂H₆ ice', 4], ['Tholins', 4]], note: 'Detected by near-infrared spectroscopy from Earth.' },
    { n: 'Tholin-stained frost', c: '#c0714e', w: 3, comp: [['CH₄ ice', 55], ['Tholins', 30], ['C₂H₆ / C₂H₄ ice', 10], ['N₂ ice', 5]], note: 'Reddish organics made by UV and cosmic rays.' },
    { n: 'Nitrogen-rich frost', c: '#dfeaf5', w: 2, comp: [['N₂ ice', 70], ['CH₄ ice', 27], ['CO ice', 3]], note: 'Seasonal frost that sublimates near perihelion.' }
  ];

  const B = [];

  // ================= SUN =================
  B.push({
    id: 'sun', name: 'Sun', type: 'star', parent: null, R: 695700, mass: 1.98847e30,
    rotH: 609.12, pole: [286.13, 63.87], pm: [84.176, 14.1844], color: '#fff1c9',
    temp: { min: 4400, mean: 5772, max: 15700000 }, tempNote: 'Photosphere 5,772 K · sunspots ~4,400 K · corona 1–2 million K · core 15.7 million K',
    landable: false, cls: 'G2V main-sequence star',
    comp: [['Hydrogen', 73.46], ['Helium', 24.85], ['Oxygen', 0.77], ['Carbon', 0.29], ['Iron', 0.16], ['Neon', 0.12], ['Nitrogen', 0.09], ['Silicon', 0.07]],
    compLabel: 'Photosphere (by mass)',
    desc: 'A 4.6-billion-year-old ball of plasma holding 99.86% of the solar system\'s mass. It fuses about 600 million tonnes of hydrogen into helium every second.',
    facts: [['Luminosity', '3.828 × 10²⁶ W'], ['Spectral class', 'G2V'], ['Age', '4.6 billion years'], ['Light reaches Earth in', '8 min 19 s']]
  });

  // ================= MERCURY =================
  B.push({
    id: 'mercury', name: 'Mercury', type: 'planet', parent: 'sun', R: 2439.7, mass: 3.3011e23,
    rotH: 1407.6, pole: [281.01, 61.41], pm: [329.5469, 6.1385025], color: '#8c8780',
    el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    rt: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    temp: { min: 100, mean: 440, max: 700 }, landable: true, cls: 'Terrestrial planet',
    exo: 'Exosphere only (~10⁻¹⁴ bar): O₂ 42%, Na 29%, H₂ 22%, He 6%, K 0.5%',
    terrain: { amp: 1.0, craters: 0.8, cmax: 220, mtn: [30, 0.12], seed: 11 },
    materials: [
      { n: 'Intercrater plains regolith', c: '#c9b8a0', w: 5, comp: [['SiO₂', 56], ['MgO', 14], ['Al₂O₃', 12], ['CaO', 6], ['Na₂O', 5], ['S', 2.5], ['FeO', 2], ['TiO₂', 0.5]], note: 'Magnesium-rich, iron-poor basalt (MESSENGER X-ray data).' },
      { n: 'Smooth volcanic plains', c: '#e0a060', w: 3, comp: [['SiO₂', 60], ['Al₂O₃', 14], ['MgO', 9], ['Na₂O', 7], ['CaO', 5], ['FeO', 2], ['S', 1.5]], note: 'Flood lavas ~3.7 billion years old.' },
      { n: 'Low-reflectance material', c: '#5a6478', w: 2, comp: [['SiO₂', 52], ['MgO', 18], ['Al₂O₃', 10], ['CaO', 7], ['S', 4], ['Graphite C', 3], ['FeO', 2.5]], note: 'Darkened by graphite from an ancient carbon crust.' },
      { n: 'Hollows sulfide deposit', c: '#9be8e0', w: 1, comp: [['MgS', 30], ['CaS', 20], ['SiO₂', 30], ['MgO', 12], ['Na / K salts', 6], ['Cl', 2]], note: 'Bright pits where volatiles are sublimating away.' }
    ],
    desc: 'The smallest planet and the closest to the Sun. A huge iron core fills 85% of its radius. A solar day lasts 176 Earth days.',
    facts: [['Solar day', '176 Earth days'], ['Core', '~85% of radius, iron'], ['Magnetic field', '1.1% of Earth\'s']]
  });

  // ================= VENUS =================
  B.push({
    id: 'venus', name: 'Venus', type: 'planet', parent: 'sun', R: 6051.8, mass: 4.8675e24,
    rotH: -5832.5, pole: [272.76, 67.16], pm: [160.20, -1.4813688], color: '#d9b47a', tex: 'venus_surface',
    el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    rt: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    temp: { min: 655, mean: 737, max: 740 }, landable: true, cls: 'Terrestrial planet',
    atm: { P: 92, H: 15.9, k: 300, comp: [['CO₂', 96.5], ['N₂', 3.5], ['SO₂', 0.015], ['Ar', 0.007], ['H₂O', 0.002]],
      zen: [0.80, 0.56, 0.22], hor: [0.90, 0.66, 0.28], sunset: [0.9, 0.5, 0.2], opacity: 1, night: 0.9, nightCol: [0.10, 0.05, 0.02],
      overcast: 1, rim: [1.0, 0.86, 0.55], rimK: 0.5, soft: 0.85, fog: 0.22, shell: 0.03 },
    clouds: { tex: 'venus_clouds', alt: 65, solid: 1, color: '#e6cf9a', fade: [58, 85] },
    terrain: { amp: 0.8, craters: 0.02, cmax: 120, mtn: [60, 0.35], ridge: 1, seed: 22 },
    materials: [
      { n: 'Tholeiitic basalt', c: '#ffb347', w: 5, comp: [['SiO₂', 48.7], ['Al₂O₃', 17.9], ['CaO', 10.3], ['FeO', 8.8], ['MgO', 8.1], ['Na₂O', 2.4], ['TiO₂', 1.25], ['K₂O', 0.2]], note: 'Measured by Venera 14 and Vega 2 landers.' },
      { n: 'Alkaline basalt', c: '#ff7b54', w: 3, comp: [['SiO₂', 45.1], ['Al₂O₃', 15.8], ['MgO', 11.4], ['FeO', 9.3], ['CaO', 7.1], ['K₂O', 4.0], ['Na₂O', 2.0], ['TiO₂', 1.6]], note: 'Potassium-rich lava measured by Venera 13.' },
      { n: 'Weathered crust', c: '#c9e265', w: 2, comp: [['SiO₂', 42], ['Fe₂O₃ (hematite)', 14], ['CaSO₄ (anhydrite)', 14], ['Al₂O₃', 14], ['MgO', 9], ['Other', 7]], note: 'Basalt altered by hot, acidic CO₂–SO₂ gas.' }
    ],
    desc: 'Earth\'s near-twin in size, wrapped in a crushing CO₂ atmosphere with sulfuric-acid clouds. The hottest planetary surface in the solar system, and it spins backwards.',
    facts: [['Surface pressure', '92 bar (like 900 m under the sea)'], ['Cloud deck', '48–70 km, H₂SO₄ droplets'], ['Rotation', 'Retrograde, 243 days']]
  });

  // ================= EARTH =================
  B.push({
    id: 'earth', name: 'Earth', type: 'planet', parent: 'sun', R: 6371.0, mass: 5.9722e24,
    rotH: 23.9344696, pole: [0, 90], pm: [190.147, 360.9856235], color: '#3f6fb0',
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rt: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    temp: { min: 184, mean: 288, max: 330 }, landable: true, cls: 'Terrestrial planet', ocean: 1, night: 'earth_night',
    atm: { P: 1.01325, H: 8.5, k: 4, comp: [['N₂', 78.08], ['O₂', 20.95], ['Ar', 0.934], ['H₂O (avg)', 0.4], ['CO₂', 0.042]],
      zen: [0.13, 0.33, 0.80], hor: [0.60, 0.76, 0.96], sunset: [1.0, 0.48, 0.16], opacity: 1, night: 0, nightCol: [0, 0, 0],
      overcast: 0, rim: [0.32, 0.58, 1.0], rimK: 0.75, soft: 0.35, fog: 0.011, shell: 0.022 },
    clouds: { tex: 'earth_clouds', alt: 9, solid: 0, color: '#ffffff', fade: [3, 14] },
    terrain: { amp: 1.1, craters: 0, mtn: [30, 0.9], ridge: 1, seed: 33, earth: 1 },
    materials: [
      { n: 'Quartz sand & soil', c: '#ffd166', w: 4, comp: [['SiO₂', 84], ['Al₂O₃', 6], ['H₂O', 3], ['Fe₂O₃', 2], ['CaO', 2], ['Organic C', 2], ['Other', 1]], note: 'Weathered continental sediment.' },
      { n: 'Granite (continental crust)', c: '#ef476f', w: 3, comp: [['SiO₂', 72], ['Al₂O₃', 14.4], ['K₂O', 4.1], ['Na₂O', 3.7], ['CaO', 1.8], ['FeO', 1.7], ['MgO', 0.7]], note: 'Quartz, feldspar and mica.' },
      { n: 'Limestone', c: '#06d6a0', w: 2, comp: [['CaO', 53], ['CO₂ (as carbonate)', 42], ['MgO', 2], ['SiO₂', 2], ['Other', 1]], note: 'Calcium carbonate laid down by marine life.' },
      { n: 'Basalt', c: '#118ab2', w: 2, comp: [['SiO₂', 50], ['Al₂O₃', 15.5], ['CaO', 11.3], ['FeO', 10], ['MgO', 8], ['Na₂O', 2.7], ['TiO₂', 1.5]], note: 'Volcanic rock; makes up the ocean floor.' }
    ],
    desc: 'The only world known to host life. Liquid water covers 71% of the surface, and plate tectonics keeps recycling the crust.',
    facts: [['Ocean coverage', '70.8%'], ['Axial tilt', '23.44°'], ['Magnetic field', '25–65 μT at surface']]
  });
  B.push({
    id: 'moon', name: 'Moon', type: 'moon', parent: 'earth', R: 1737.4, mass: 7.342e22,
    orbit: { a: 384399, P: 27.321661, e: 0.0549, inc: 5.145, luna: 1 }, locked: 1, pole: [269.9949, 66.5392], color: '#9a9690',
    temp: { min: 95, mean: 250, max: 390 }, landable: true, cls: 'Rocky moon',
    exo: 'Exosphere only (~3 × 10⁻¹⁵ bar): He, Ar, Ne, Na, K',
    terrain: { amp: 1.2, craters: 0.85, cmax: 300, mtn: [25, 0.12], seed: 44 },
    materials: [
      { n: 'Mare basalt', c: '#4d8fd1', w: 4, comp: [['SiO₂', 44], ['FeO', 19], ['CaO', 11], ['Al₂O₃', 10], ['MgO', 8], ['TiO₂', 7], ['Na₂O', 0.4]], note: 'Dark volcanic plains (Apollo 11, 12, 15, 17).' },
      { n: 'Highland anorthosite', c: '#f4e9c8', w: 4, comp: [['SiO₂', 45], ['Al₂O₃', 27], ['CaO', 15.5], ['MgO', 6], ['FeO', 5], ['TiO₂', 0.5], ['Na₂O', 0.5]], note: 'Original crust that floated on the magma ocean (Apollo 16).' },
      { n: 'Regolith breccia', c: '#e07a5f', w: 3, comp: [['SiO₂', 46], ['Al₂O₃', 18], ['CaO', 12.5], ['FeO', 12], ['MgO', 9], ['TiO₂', 2], ['Glass agglutinates', 0.5]], note: 'Impact-welded soil with solar-wind hydrogen and helium-3.' },
      { n: 'KREEP basalt', c: '#b56cf0', w: 1, comp: [['SiO₂', 50], ['Al₂O₃', 15], ['FeO', 10.5], ['CaO', 9.5], ['MgO', 8], ['TiO₂', 2], ['K₂O', 0.9], ['P₂O₅', 0.7]], note: 'Rich in potassium, rare-earth elements and phosphorus.' }
    ],
    desc: 'Earth\'s only natural satellite, formed from debris of a giant impact 4.5 billion years ago. Twelve people walked here between 1969 and 1972.',
    facts: [['Tidally locked', 'Same face always toward Earth'], ['Recession rate', '3.8 cm per year'], ['Human landings', '6 (Apollo 11–17)']]
  });

  // ================= MARS =================
  B.push({
    id: 'mars', name: 'Mars', type: 'planet', parent: 'sun', R: 3389.5, mass: 6.4171e23,
    rotH: 24.622962, pole: [317.681, 52.887], pm: [176.630, 350.89198226], color: '#b5603a',
    el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rt: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    temp: { min: 130, mean: 210, max: 308 }, landable: true, cls: 'Terrestrial planet',
    atm: { P: 0.00636, H: 11.1, k: 2.2, comp: [['CO₂', 95.0], ['N₂', 2.6], ['Ar', 1.9], ['O₂', 0.16], ['CO', 0.06]],
      zen: [0.52, 0.40, 0.29], hor: [0.80, 0.63, 0.46], sunset: [0.30, 0.45, 0.75], opacity: 0.92, night: 0, nightCol: [0, 0, 0],
      overcast: 0, rim: [0.95, 0.66, 0.45], rimK: 0.3, soft: 0.12, fog: 0.007, shell: 0.016 },
    terrain: { amp: 2.0, craters: 0.3, cmax: 200, mtn: [50, 0.35], dunes: [0.18, 0.009], seed: 55 },
    materials: [
      { n: 'Basaltic soil', c: '#ff9f4a', w: 5, comp: [['SiO₂', 43], ['Fe oxides', 19], ['Al₂O₃', 9.4], ['MgO', 8.7], ['CaO', 7.3], ['SO₃', 5.5], ['Na₂O', 2.7], ['Cl', 0.7]], note: 'Global dust and sand (Spirit, Curiosity). Contains ~0.5% perchlorate.' },
      { n: 'Olivine basalt', c: '#5aa9e6', w: 3, comp: [['SiO₂', 45.7], ['FeO', 18.8], ['Al₂O₃', 10.9], ['MgO', 10.8], ['CaO', 7.8], ['Na₂O', 2.4], ['TiO₂', 0.5]], note: 'Unweathered volcanic rock (Adirondack class, Gusev crater).' },
      { n: 'Sulfate sandstone', c: '#f7e36b', w: 2, comp: [['SiO₂', 37], ['SO₃', 22], ['Fe₂O₃', 17], ['MgO', 8], ['Al₂O₃', 6], ['CaO', 5], ['Other', 5]], note: 'Jarosite and hematite "blueberries" — evidence of ancient acidic water.' },
      { n: 'Clay mudstone', c: '#7bd88f', w: 1, comp: [['SiO₂', 43], ['FeO', 20], ['MgO', 9], ['Al₂O₃', 8.5], ['CaO', 6], ['Smectite-bound H₂O', 5], ['SO₃', 4]], note: 'Lake-bed sediment with ~20% smectite clay (Gale crater).' }
    ],
    desc: 'A cold desert world with the tallest volcano and deepest canyon in the solar system. Rivers and lakes once flowed here; water ice survives at the poles and underground.',
    facts: [['Olympus Mons', '21.9 km high'], ['Valles Marineris', '4,000 km long, 7 km deep'], ['Sol length', '24 h 39 m 35 s']]
  });
  B.push({
    id: 'phobos', name: 'Phobos', type: 'moon', parent: 'mars', R: 11.08, mass: 1.0659e16,
    orbit: { a: 9376, P: 0.31891023, e: 0.0151, inc: 1.08, ph: 40 }, locked: 1, color: '#6e645b',
    temp: { min: 161, mean: 233, max: 268 }, landable: true, cls: 'Irregular moon (27 × 22 × 18 km)',
    terrain: { amp: 0.55, W: 9, craters: 0.75, cmax: 4.5, seed: 61 }, materials: CARBON,
    desc: 'A dark, potato-shaped moon orbiting just 6,000 km above Mars — faster than Mars rotates. Tides are pulling it inward about 1.8 cm per year.',
    facts: [['Orbit', '3 per Martian day'], ['Largest crater', 'Stickney, 9 km'], ['Shape', 'Modelled here as a rough sphere']]
  });
  B.push({
    id: 'deimos', name: 'Deimos', type: 'moon', parent: 'mars', R: 6.2, mass: 1.4762e15,
    orbit: { a: 23463.2, P: 1.263, e: 0.00033, inc: 1.79, ph: 200 }, locked: 1, color: '#8a7d6f',
    temp: { min: 180, mean: 233, max: 270 }, landable: true, cls: 'Irregular moon (15 × 12 × 11 km)',
    terrain: { amp: 0.3, W: 6, craters: 0.45, cmax: 1.2, seed: 62 }, materials: CARBON,
    desc: 'The smaller, outer moon of Mars, blanketed in smooth regolith. Escape velocity is about 5.6 m/s — a good jump would put you in orbit.',
    facts: [['Escape velocity', '~20 km/h'], ['Shape', 'Modelled here as a rough sphere']]
  });

  // ================= CERES =================
  B.push({
    id: 'ceres', name: 'Ceres', type: 'dwarf', parent: 'sun', R: 469.7, mass: 9.3839e20,
    rotH: 9.07417, pole: [291.418, 66.764], pm: [170.65, 952.1532], color: '#7d7a76',
    kep: { a: 2.7691, e: 0.0760, i: 10.594, O: 80.305, w: 73.597, M0: 77.372, ep: 7055.5, P: 1683.14 },
    temp: { min: 110, mean: 168, max: 235 }, landable: true, cls: 'Dwarf planet (asteroid belt)',
    terrain: { amp: 0.9, craters: 0.75, cmax: 90, seed: 71 },
    materials: [
      { n: 'Ammoniated clay regolith', c: '#b39ddb', w: 6, comp: [['Mg-phyllosilicates', 48], ['NH₄-bearing clays', 12], ['Mg-Ca carbonates', 10], ['Magnetite & dark phases', 16], ['H₂O ice', 9], ['Organics', 5]], note: 'Mapped by Dawn\'s VIR spectrometer.' },
      { n: 'Sodium-carbonate salts', c: '#fff59d', w: 1, comp: [['Na₂CO₃', 55], ['NH₄Cl', 8], ['Hydrohalite NaCl·2H₂O', 7], ['Phyllosilicates', 25], ['Other', 5]], note: 'Bright faculae left by evaporating brine (as in Occator crater).' },
      { n: 'Ice-rich subsurface', c: '#81d4fa', w: 2, comp: [['H₂O ice', 35], ['Phyllosilicates', 45], ['Carbonates', 10], ['Salts', 10]], note: 'Exposed in fresh craters and landslides.' }
    ],
    desc: 'The largest object in the asteroid belt and the only dwarf planet in the inner solar system. Briny water has erupted onto its surface in the geologically recent past.',
    facts: [['Visited by', 'Dawn (2015–2018)'], ['Tallest mountain', 'Ahuna Mons, 4 km cryovolcano'], ['Water content', '~25% by mass']]
  });

  // ================= JUPITER =================
  B.push({
    id: 'jupiter', name: 'Jupiter', type: 'planet', parent: 'sun', R: 69911, Req: 71492, flat: 0.06487, mass: 1.89813e27,
    rotH: 9.925, pole: [268.057, 64.495], pm: [284.95, 870.5360], color: '#c8a880',
    el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rt: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    temp: { min: 112, mean: 165, max: 165 }, tempNote: '165 K at the 1-bar level · 112 K at the 0.1-bar cloud tops · ~24,000 K at the core',
    landable: false, gas: 1, cls: 'Gas giant',
    atm: { P: null, H: 27, k: 1, comp: [['H₂', 89.8], ['He', 10.2], ['CH₄', 0.3], ['NH₃', 0.026], ['HD', 0.0028], ['H₂O', 0.0004]],
      zen: [0.55, 0.50, 0.46], hor: [0.80, 0.70, 0.56], sunset: [0.9, 0.6, 0.4], opacity: 1, night: 1, nightCol: [0.03, 0.025, 0.02],
      overcast: 0, rim: [0.95, 0.85, 0.7], rimK: 0.22, soft: 0.55, fog: 0, shell: 0.012 },
    rings: { inner: 92000, outer: 129000, bands: [[92000, 122500, 0.02], [122500, 129000, 0.06]], color: [0.75, 0.62, 0.5] },
    desc: 'The largest planet — 318 Earth masses of hydrogen and helium with no solid surface. The Great Red Spot is a storm wider than Earth that has raged for centuries.',
    facts: [['Moons known', '95'], ['Great Red Spot', '~16,000 km wide'], ['Magnetosphere', 'Largest structure in the solar system']]
  });
  B.push({
    id: 'io', name: 'Io', type: 'moon', parent: 'jupiter', R: 1821.6, mass: 8.931938e22,
    orbit: { a: 421700, P: 1.769138, e: 0.0041, inc: 0.04, ph: 163.8 }, locked: 1, color: '#d9c45a',
    temp: { min: 90, mean: 110, max: 130 }, tempNote: 'Surface ~110 K; active lava up to 1,600 K', landable: true, cls: 'Volcanic moon',
    exo: 'Thin SO₂ atmosphere (~10⁻⁹ bar) fed by volcanoes',
    terrain: { amp: 0.5, craters: 0, mtn: [80, 1.3], ridge: 1, seed: 81 },
    materials: [
      { n: 'Sulfur dioxide frost', c: '#f8f4e3', w: 4, comp: [['SO₂ frost', 84], ['Elemental S', 11], ['NaCl', 3], ['KCl', 1], ['Other', 1]], note: 'White plains of volcanic gas that froze onto the ground.' },
      { n: 'Sulfur allotropes', c: '#ffd23f', w: 4, comp: [['S₈ (yellow)', 62], ['S₃ / S₄ (red)', 14], ['SO₂ frost', 16], ['Na / K sulfides', 6], ['Other', 2]], note: 'Yellow, orange and red sulfur from plume fallout.' },
      { n: 'Silicate lava', c: '#e4572e', w: 2, comp: [['SiO₂', 46], ['MgO', 20], ['FeO', 15], ['Al₂O₃', 8], ['CaO', 7], ['S', 3], ['Na₂O', 1]], note: 'Magnesium-rich basalt, hotter than any lava on Earth today.' }
    ],
    desc: 'The most volcanically active body known. Tidal flexing by Jupiter heats the interior and powers over 400 active volcanoes; the surface has no impact craters at all.',
    facts: [['Active volcanoes', '400+'], ['Plume height', 'Up to 500 km'], ['Radiation', '~3,600 rem per day']]
  });
  B.push({
    id: 'europa', name: 'Europa', type: 'moon', parent: 'jupiter', R: 1560.8, mass: 4.799844e22,
    orbit: { a: 671100, P: 3.551181, e: 0.0094, inc: 0.47, ph: 358.4 }, locked: 1, color: '#cdbf9f',
    temp: { min: 50, mean: 102, max: 125 }, landable: true, cls: 'Icy ocean moon',
    exo: 'Tenuous O₂ exosphere (~10⁻¹² bar)',
    terrain: { amp: 0.06, craters: 0.02, cmax: 20, mtn: [14, 0.11], ridge: 1, mtnAll: 1, seed: 82 },
    materials: [
      { n: 'Water-ice crust', c: '#a8e0ff', w: 5, comp: [['H₂O ice', 95.5], ['MgSO₄ hydrates', 2.5], ['H₂O₂', 0.13], ['CO₂', 0.4], ['SO₂', 0.5], ['Other', 1]], note: 'Among the smoothest surfaces in the solar system.' },
      { n: 'Lineae salt deposit', c: '#d9825b', w: 3, comp: [['H₂O ice', 58], ['MgSO₄·nH₂O', 20], ['NaCl (irradiated)', 11], ['H₂SO₄ hydrate', 9], ['Other', 2]], note: 'Reddish-brown bands where ocean material welled up through cracks.' },
      { n: 'Chaos-terrain matrix', c: '#f2c14e', w: 2, comp: [['H₂O ice', 78], ['NaCl', 9], ['MgSO₄ hydrates', 8], ['Na₂CO₃', 3], ['Other', 2]], note: 'Refrozen slush between tilted ice blocks.' }
    ],
    desc: 'Beneath an ice shell 15–25 km thick lies a salt-water ocean holding twice the water of all Earth\'s oceans — one of the best places to look for life.',
    facts: [['Ocean depth', '60–150 km'], ['Ice shell', '15–25 km'], ['Surface age', '40–90 million years']]
  });
  B.push({
    id: 'ganymede', name: 'Ganymede', type: 'moon', parent: 'jupiter', R: 2634.1, mass: 1.4819e23,
    orbit: { a: 1070400, P: 7.154553, e: 0.0013, inc: 0.2, ph: 5.7 }, locked: 1, color: '#8f8676',
    temp: { min: 70, mean: 110, max: 152 }, landable: true, cls: 'Icy moon',
    exo: 'Tenuous O₂ exosphere',
    terrain: { amp: 0.45, craters: 0.4, cmax: 150, mtn: [20, 0.18], ridge: 1, seed: 83 },
    materials: [
      { n: 'Bright grooved-terrain ice', c: '#b8e6ff', w: 4, comp: [['H₂O ice', 90], ['Silicates', 5], ['MgSO₄ hydrates', 3], ['CO₂', 1], ['Other', 1]], note: 'Younger, tectonically resurfaced ice.' },
      { n: 'Dark terrain regolith', c: '#9c7b5c', w: 4, comp: [['H₂O ice', 55], ['Hydrated silicates', 33], ['Organics', 6], ['CO₂', 2], ['SO₂', 1], ['Other', 3]], note: 'Ancient, heavily cratered crust ~4 billion years old.' },
      { n: 'Polar frost', c: '#ffffff', w: 1, comp: [['H₂O ice (amorphous)', 97], ['O₂ / O₃ trapped', 1], ['CO₂', 1], ['Other', 1]], note: 'Frost redistributed along magnetic field lines.' }
    ],
    desc: 'The largest moon in the solar system — bigger than Mercury — and the only moon with its own magnetic field. It hides a deep salty ocean between layers of ice.',
    facts: [['Diameter', '5,268 km'], ['Own magnetosphere', 'Yes, unique among moons']]
  });
  B.push({
    id: 'callisto', name: 'Callisto', type: 'moon', parent: 'jupiter', R: 2410.3, mass: 1.075938e23,
    orbit: { a: 1882700, P: 16.689017, e: 0.0074, inc: 0.19, ph: 224.8 }, locked: 1, color: '#6b6158',
    temp: { min: 80, mean: 134, max: 165 }, landable: true, cls: 'Icy moon',
    exo: 'Tenuous CO₂ exosphere',
    terrain: { amp: 0.35, craters: 0.95, cmax: 250, seed: 84 },
    materials: [
      { n: 'Dark lag regolith', c: '#a1887f', w: 6, comp: [['Hydrated silicates', 48], ['H₂O ice', 36], ['Organics', 9], ['CO₂ ice', 3], ['SO₂', 2], ['Other', 2]], note: 'Dust left behind as surface ice slowly sublimates.' },
      { n: 'Bright frost knobs', c: '#e1f5fe', w: 3, comp: [['H₂O ice', 86], ['Silicates', 9], ['CO₂ ice', 4], ['Other', 1]], note: 'Clean ice on crater rims and peaks.' }
    ],
    desc: 'The most heavily cratered body in the solar system. Its surface is about 4 billion years old and has barely changed since.',
    facts: [['Largest basin', 'Valhalla, 3,800 km of rings'], ['Radiation', 'Low — outside Jupiter\'s main belts']]
  });

  // ================= SATURN =================
  B.push({
    id: 'saturn', name: 'Saturn', type: 'planet', parent: 'sun', R: 58232, Req: 60268, flat: 0.09796, mass: 5.6834e26,
    rotH: 10.656, pole: [40.589, 83.537], pm: [38.90, 810.7939024], color: '#d9c48f',
    el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rt: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    temp: { min: 84, mean: 134, max: 134 }, tempNote: '134 K at the 1-bar level · 84 K at 0.1 bar', landable: false, gas: 1, cls: 'Gas giant',
    atm: { P: null, H: 59.5, k: 1, comp: [['H₂', 96.3], ['He', 3.25], ['CH₄', 0.45], ['NH₃', 0.0125], ['HD', 0.011], ['C₂H₆', 0.0007]],
      zen: [0.60, 0.55, 0.42], hor: [0.86, 0.77, 0.55], sunset: [0.9, 0.7, 0.4], opacity: 1, night: 1, nightCol: [0.03, 0.028, 0.02],
      overcast: 0, rim: [0.98, 0.9, 0.7], rimK: 0.22, soft: 0.6, fog: 0, shell: 0.012 },
    rings: { inner: 66900, outer: 140500, saturn: 1, color: [0.86, 0.79, 0.66] },
    desc: 'The least dense planet — it would float in water — circled by rings of water ice 280,000 km across yet typically only about 10 m thick.',
    facts: [['Moons known', '146+'], ['Ring span', '66,900 – 140,180 km from centre'], ['Ring thickness', '~10 m'], ['North-pole hexagon', '29,000 km wide jet stream']]
  });
  B.push({
    id: 'mimas', name: 'Mimas', type: 'moon', parent: 'saturn', R: 198.2, mass: 3.7493e19,
    orbit: { a: 185539, P: 0.942422, e: 0.0196, inc: 1.57, ph: 15 }, locked: 1, color: '#b9b6b0',
    temp: { min: 60, mean: 64, max: 95 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 0.5, craters: 0.95, cmax: 60, seed: 91 }, materials: ICE_SAT,
    desc: 'A small ice moon dominated by the 130-km crater Herschel, which makes it look like the Death Star.',
    facts: [['Herschel crater', '130 km wide, 10 km deep']]
  });
  B.push({
    id: 'enceladus', name: 'Enceladus', type: 'moon', parent: 'saturn', R: 252.1, mass: 1.08022e20,
    orbit: { a: 237948, P: 1.370218, e: 0.0047, inc: 0.02, ph: 95 }, locked: 1, color: '#f2f5f7',
    temp: { min: 33, mean: 75, max: 145 }, landable: true, cls: 'Icy ocean moon',
    exo: 'Water-vapour plume from the south pole (91% H₂O, 4% N₂, 3% CO₂, 2% CH₄)',
    terrain: { amp: 0.14, craters: 0.2, cmax: 20, mtn: [8, 0.1], ridge: 1, seed: 92 },
    materials: [
      { n: 'Fresh plume snow', c: '#e6fbff', w: 6, comp: [['H₂O ice', 99], ['NaCl / NaHCO₃', 0.5], ['CO₂', 0.3], ['NH₃', 0.1], ['SiO₂ nanograins', 0.1]], note: 'The most reflective surface in the solar system (albedo ~0.99).' },
      { n: 'Tiger-stripe ice', c: '#4dd0e1', w: 2, comp: [['H₂O ice (crystalline)', 94.5], ['CO₂', 2], ['Salts', 1.5], ['Organics', 1.2], ['NH₃', 0.8]], note: 'Warm fractures that vent ocean water into space.' },
      { n: 'Old cratered ice', c: '#90a4ae', w: 2, comp: [['H₂O ice', 98.5], ['CO₂', 0.8], ['Silicates', 0.7]], note: 'Northern plains untouched by recent resurfacing.' }
    ],
    desc: 'A tiny, brilliant-white moon that sprays its subsurface ocean into space through geysers. The plume contains salts, silica and organic molecules.',
    facts: [['Geysers', '100+ jets at the south pole'], ['Ocean', 'Global, ~30 km deep'], ['Feeds', 'Saturn\'s E ring']]
  });
  B.push({
    id: 'tethys', name: 'Tethys', type: 'moon', parent: 'saturn', R: 531.1, mass: 6.17449e20,
    orbit: { a: 294619, P: 1.887802, e: 0.0001, inc: 1.12, ph: 190 }, locked: 1, color: '#c9c7c2',
    temp: { min: 70, mean: 86, max: 90 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 0.5, craters: 0.85, cmax: 120, seed: 93 }, materials: ICE_SAT,
    desc: 'Almost pure water ice (density 0.98 g/cm³). Ithaca Chasma, a canyon 2,000 km long, runs three-quarters of the way around it.',
    facts: [['Odysseus crater', '445 km wide'], ['Ithaca Chasma', '2,000 km long']]
  });
  B.push({
    id: 'dione', name: 'Dione', type: 'moon', parent: 'saturn', R: 561.4, mass: 1.095452e21,
    orbit: { a: 377396, P: 2.736915, e: 0.0022, inc: 0.02, ph: 280 }, locked: 1, color: '#bdbbb6',
    temp: { min: 70, mean: 87, max: 95 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 0.5, craters: 0.8, cmax: 100, mtn: [12, 0.1], ridge: 1, seed: 94 }, materials: ICE_SAT,
    desc: 'An ice moon with bright "wispy" cliffs of fractured ice on its trailing hemisphere.',
    facts: [['Ice cliffs', 'Hundreds of metres high']]
  });
  B.push({
    id: 'rhea', name: 'Rhea', type: 'moon', parent: 'saturn', R: 763.8, mass: 2.306518e21,
    orbit: { a: 527108, P: 4.518212, e: 0.0013, inc: 0.35, ph: 320 }, locked: 1, color: '#b5b2ac',
    temp: { min: 53, mean: 76, max: 99 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 0.5, craters: 0.9, cmax: 150, seed: 95 }, materials: ICE_SAT,
    desc: 'Saturn\'s second-largest moon: a heavily cratered ball of about three-quarters ice and one-quarter rock.',
    facts: [['Exosphere', 'Trace O₂ and CO₂']]
  });
  B.push({
    id: 'titan', name: 'Titan', type: 'moon', parent: 'saturn', R: 2574.73, mass: 1.3452e23,
    orbit: { a: 1221870, P: 15.945421, e: 0.0288, inc: 0.35, ph: 60 }, locked: 1, color: '#c98a3c',
    temp: { min: 90, mean: 94, max: 95 }, landable: true, cls: 'Moon with thick atmosphere',
    atm: { P: 1.467, H: 45, k: 60, comp: [['N₂', 94.2], ['CH₄', 5.65], ['H₂', 0.1], ['C₂H₆ & organics', 0.05]],
      zen: [0.60, 0.38, 0.13], hor: [0.76, 0.50, 0.19], sunset: [0.7, 0.4, 0.15], opacity: 1, night: 0.95, nightCol: [0.05, 0.03, 0.012],
      overcast: 1, rim: [0.95, 0.65, 0.3], rimK: 0.5, soft: 0.9, fog: 0.07, shell: 0.12 },
    clouds: { tex: null, alt: 200, solid: 1, color: '#d59a45', fade: [120, 320] },
    terrain: { amp: 0.14, craters: 0.01, cmax: 40, mtn: [25, 0.25], ridge: 1, dunes: [2.2, 0.09], seed: 96 },
    materials: [
      { n: 'Water-ice bedrock', c: '#7fdbff', w: 4, comp: [['H₂O ice', 72], ['Tholins', 18], ['CH₄ / C₂H₆ (liquid)', 5], ['NH₃ hydrate', 3], ['CO₂ ice', 2]], note: 'Rock-hard ice pebbles like those seen by the Huygens probe.' },
      { n: 'Organic dune sand', c: '#ff9933', w: 4, comp: [['Tholins (C-H-N polymers)', 80], ['Benzene / acetylene ice', 10], ['H₂O ice', 6], ['Nitriles', 4]], note: 'Dark hydrocarbon grains that drift down from the haze.' },
      { n: 'Evaporite deposit', c: '#f6f193', w: 1, comp: [['Butane / acetylene solids', 55], ['Tholins', 25], ['H₂O ice', 12], ['Nitriles', 8]], note: 'Residue left where methane–ethane lakes dried out.' }
    ],
    desc: 'The only moon with a dense atmosphere and the only other world with stable surface liquid: rivers, lakes and seas of methane and ethane under an orange smog.',
    facts: [['Surface liquid', 'Methane–ethane seas'], ['Landed', 'Huygens probe, 14 Jan 2005'], ['Air density', '4× Earth\'s at the surface']]
  });
  B.push({
    id: 'iapetus', name: 'Iapetus', type: 'moon', parent: 'saturn', R: 734.5, mass: 1.805635e21,
    orbit: { a: 3560820, P: 79.3215, e: 0.0283, inc: 15.47, ph: 130 }, locked: 1, color: '#8a7f73',
    temp: { min: 90, mean: 110, max: 130 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 1.4, craters: 0.9, cmax: 180, seed: 97 },
    materials: [
      { n: 'Dark Cassini Regio lag', c: '#8d6e63', w: 4, comp: [['Carbonaceous organics (PAH)', 42], ['H₂O ice', 32], ['Nanophase hematite / iron', 14], ['Silicates', 8], ['CO₂', 4]], note: 'Coal-dark dust swept up on the leading hemisphere.' },
      { n: 'Bright trailing-side ice', c: '#eaf6ff', w: 4, comp: [['H₂O ice', 97], ['CO₂ ice', 2], ['Dark dust', 1]], note: 'Ten times brighter than the dark side.' }
    ],
    desc: 'The two-toned moon: one hemisphere is as dark as coal and the other as bright as snow. A 13-km-high ridge runs along its equator.',
    facts: [['Equatorial ridge', '13 km high, 1,300 km long'], ['Albedo contrast', '0.04 vs 0.6']]
  });

  // ================= URANUS =================
  B.push({
    id: 'uranus', name: 'Uranus', type: 'planet', parent: 'sun', R: 25362, Req: 25559, flat: 0.02293, mass: 8.6810e25,
    rotH: -17.24, pole: [257.311, -15.175], pm: [203.81, -501.1600928], color: '#a6d7de',
    el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    rt: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    temp: { min: 49, mean: 76, max: 76 }, tempNote: '76 K at the 1-bar level · 49 K at the tropopause — the coldest planetary atmosphere', landable: false, gas: 1, cls: 'Ice giant',
    atm: { P: null, H: 27.7, k: 1, comp: [['H₂', 82.5], ['He', 15.2], ['CH₄', 2.3], ['HD', 0.0148]],
      zen: [0.45, 0.72, 0.78], hor: [0.66, 0.88, 0.92], sunset: [0.7, 0.85, 0.85], opacity: 1, night: 1, nightCol: [0.015, 0.03, 0.035],
      overcast: 0, rim: [0.7, 0.93, 0.97], rimK: 0.25, soft: 0.65, fog: 0, shell: 0.014 },
    rings: { inner: 38000, outer: 52000, color: [0.55, 0.58, 0.6],
      bands: [[41837, 41839, 0.3], [42234, 42236, 0.3], [42571, 42574, 0.3], [44718, 44728, 0.4], [45661, 45672, 0.4], [47176, 47178, 0.3], [47627, 47631, 0.5], [48300, 48307, 0.5], [51110, 51190, 0.85]] },
    desc: 'An ice giant tipped 97.8° on its side, so its poles take turns facing the Sun for 21 years each. Methane gives it a pale cyan colour.',
    facts: [['Axial tilt', '97.77°'], ['Moons known', '28'], ['Rings', '13 narrow, dark rings']]
  });
  const ura = (id, name, R, mass, a, P, inc, ph, col, T, amp, cr, ridge, desc, facts) => B.push({
    id, name, type: 'moon', parent: 'uranus', R, mass, orbit: { a, P, e: 0.001, inc, ph }, locked: 1, color: col,
    temp: { min: T - 12, mean: T, max: T + 12 }, landable: true, cls: 'Icy moon',
    terrain: { amp, craters: cr, cmax: R * 0.22, mtn: ridge ? [18, ridge] : null, ridge: 1, seed: 100 + B.length }, materials: ICE_URA, desc, facts
  });
  ura('miranda', 'Miranda', 235.8, 6.293e19, 129900, 1.413479, 4.34, 25, '#a9a9a6', 60, 1.2, 0.5, 0.9,
    'A patchwork moon of ridges, grooves and the tallest known cliff in the solar system.', [['Verona Rupes', 'Cliff ~20 km high']]);
  ura('ariel', 'Ariel', 578.9, 1.2331e21, 190900, 2.520379, 0.04, 115, '#b3b0aa', 60, 0.6, 0.4, 0.5,
    'The brightest Uranian moon, cut by fault canyons and smoothed by icy flows.', [['Surface', 'Youngest of Uranus\' moons']]);
  ura('umbriel', 'Umbriel', 584.7, 1.2885e21, 266000, 4.144177, 0.13, 205, '#6f6d6b', 75, 0.4, 0.9, 0,
    'The darkest Uranian moon; ancient, cratered, and marked by one bright ring called Wunda.', [['Albedo', '0.21']]);
  ura('titania', 'Titania', 788.9, 3.4550e21, 436300, 8.705872, 0.08, 295, '#9d9a94', 70, 0.5, 0.6, 0.3,
    'The largest moon of Uranus, crossed by rift canyons up to 1,500 km long.', [['Messina Chasmata', '1,500 km long']]);
  ura('oberon', 'Oberon', 761.4, 3.1104e21, 583500, 13.463239, 0.07, 50, '#8f8a84', 75, 0.5, 0.9, 0,
    'The outermost large moon of Uranus, with dark-floored craters and a mountain 11 km tall.', [['Tallest peak', '~11 km']]);

  // ================= NEPTUNE =================
  B.push({
    id: 'neptune', name: 'Neptune', type: 'planet', parent: 'sun', R: 24622, Req: 24764, flat: 0.01708, mass: 1.02409e26,
    rotH: 16.11, pole: [299.36, 43.46], pm: [253.18, 536.3128492], color: '#3d5fc4',
    el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rt: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
    temp: { min: 55, mean: 72, max: 72 }, tempNote: '72 K at the 1-bar level · 55 K at 0.1 bar', landable: false, gas: 1, cls: 'Ice giant',
    atm: { P: null, H: 19.7, k: 1, comp: [['H₂', 80], ['He', 19], ['CH₄', 1.5], ['HD', 0.019]],
      zen: [0.14, 0.26, 0.70], hor: [0.30, 0.48, 0.88], sunset: [0.4, 0.5, 0.8], opacity: 1, night: 1, nightCol: [0.008, 0.012, 0.035],
      overcast: 0, rim: [0.45, 0.62, 1.0], rimK: 0.3, soft: 0.6, fog: 0, shell: 0.014 },
    rings: { inner: 40000, outer: 64000, color: [0.6, 0.6, 0.65], bands: [[41000, 43000, 0.03], [53150, 53260, 0.12], [57100, 57300, 0.05], [62900, 62970, 0.18]] },
    desc: 'The outermost planet, a deep-blue ice giant with the fastest winds ever measured — up to 2,100 km/h. Found by mathematics before it was seen.',
    facts: [['Wind speed', 'Up to 2,100 km/h'], ['Moons known', '16'], ['Discovered', '1846, by prediction']]
  });
  B.push({
    id: 'proteus', name: 'Proteus', type: 'moon', parent: 'neptune', R: 210, mass: 4.4e19,
    orbit: { a: 117647, P: 1.122315, e: 0.0005, inc: 0.08, ph: 70 }, locked: 1, color: '#6d6a68',
    temp: { min: 40, mean: 51, max: 55 }, landable: true, cls: 'Irregular moon (424 × 390 × 396 km)',
    terrain: { amp: 3, W: 150, craters: 0.85, cmax: 70, seed: 121 }, materials: ICE_URA,
    desc: 'A dark, lumpy moon about as large as a body can be without gravity pulling it into a sphere.',
    facts: [['Pharos crater', '~250 km wide']]
  });
  B.push({
    id: 'triton', name: 'Triton', type: 'moon', parent: 'neptune', R: 1353.4, mass: 2.1390e22,
    orbit: { a: 354759, P: 5.876854, e: 0.000016, inc: 156.865, ph: 240 }, locked: 1, color: '#c9b9b0',
    temp: { min: 34, mean: 38, max: 40 }, landable: true, cls: 'Captured icy moon',
    atm: { P: 1.4e-5, H: 14.8, k: 0.05, comp: [['N₂', 99.9], ['CH₄', 0.03], ['CO', 0.05]],
      zen: [0.2, 0.25, 0.4], hor: [0.4, 0.45, 0.6], sunset: [0.5, 0.5, 0.6], opacity: 0.06, night: 0, nightCol: [0, 0, 0],
      overcast: 0, rim: [0.6, 0.7, 0.95], rimK: 0.08, soft: 0.03, fog: 0, shell: 0.01 },
    terrain: { amp: 0.25, craters: 0.04, cmax: 15, mtn: [9, 0.16], ridge: 1, mtnAll: 1, seed: 122 },
    materials: [
      { n: 'Nitrogen ice plains', c: '#ffc4d6', w: 5, comp: [['N₂ ice', 56], ['H₂O ice', 24], ['CO₂ ice', 15], ['CH₄ ice', 4], ['CO ice', 1]], note: 'Pinkish seasonal frost on the southern polar cap.' },
      { n: 'Cantaloupe-terrain ice', c: '#7ad0c0', w: 3, comp: [['H₂O ice', 58], ['CO₂ ice', 26], ['N₂ ice', 10], ['NH₃ hydrate', 4], ['CH₄', 2]], note: 'Dimpled crust formed by rising blobs of ice (diapirs).' },
      { n: 'Plume streak deposit', c: '#6b5b73', w: 1, comp: [['Organic dust (tholins)', 45], ['N₂ ice', 35], ['CH₄ ice', 12], ['H₂O ice', 8]], note: 'Dark fallout from nitrogen geysers 8 km high.' }
    ],
    desc: 'Neptune\'s giant moon orbits backwards — it is a captured Kuiper Belt object. At 38 K it is one of the coldest surfaces known, yet nitrogen geysers erupt from it.',
    facts: [['Orbit', 'Retrograde, inclined 157°'], ['Geysers', 'Nitrogen plumes 8 km high'], ['Atmosphere', 'N₂, 14 microbar']]
  });

  // ================= PLUTO & KUIPER BELT =================
  B.push({
    id: 'pluto', name: 'Pluto', type: 'dwarf', parent: 'sun', R: 1188.3, mass: 1.303e22,
    rotH: -153.2935, pole: [132.993, -6.163], pm: [302.695, 56.3625225], color: '#c9a98a',
    el: [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    rt: [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
    temp: { min: 33, mean: 44, max: 55 }, landable: true, cls: 'Dwarf planet (Kuiper Belt)',
    atm: { P: 1.0e-5, H: 50, k: 0.06, comp: [['N₂', 99], ['CH₄', 0.25], ['CO', 0.05]],
      zen: [0.10, 0.16, 0.36], hor: [0.30, 0.42, 0.70], sunset: [0.4, 0.5, 0.8], opacity: 0.08, night: 0, nightCol: [0, 0, 0],
      overcast: 0, rim: [0.45, 0.62, 1.0], rimK: 0.14, soft: 0.04, fog: 0, shell: 0.04 },
    terrain: { amp: 0.7, craters: 0.25, cmax: 90, mtn: [20, 0.45], ridge: 1, seed: 131 },
    materials: [
      { n: 'Nitrogen ice plain', c: '#fff3e0', w: 4, comp: [['N₂ ice', 88], ['CH₄ ice', 6], ['CO ice', 5], ['Tholins', 1]], note: 'Slowly convecting glacier, like Sputnik Planitia.' },
      { n: 'Water-ice bedrock', c: '#64b5f6', w: 3, comp: [['H₂O ice', 90], ['CH₄ frost', 7], ['Tholins', 3]], note: 'At 40 K water ice is as hard as rock; it forms the mountains.' },
      { n: 'Tholin mantle', c: '#a1442a', w: 3, comp: [['Tholins', 64], ['H₂O ice', 25], ['CH₄ ice', 9], ['Other', 2]], note: 'Dark red organic residue, as in Cthulhu Macula.' }
    ],
    desc: 'A complex frozen world with nitrogen glaciers, water-ice mountains and a thin blue haze. Its heart-shaped plain is called Tombaugh Regio.',
    facts: [['Visited by', 'New Horizons, 14 Jul 2015'], ['Orbit period', '248 years'], ['Moons', '5 (Charon, Styx, Nix, Kerberos, Hydra)']]
  });
  B.push({
    id: 'charon', name: 'Charon', type: 'moon', parent: 'pluto', R: 606.0, mass: 1.5897e21,
    orbit: { a: 19596, P: 6.38723, e: 0.0002, inc: 0.08, ph: 0 }, locked: 1, color: '#9a9590',
    temp: { min: 40, mean: 53, max: 60 }, landable: true, cls: 'Icy moon',
    terrain: { amp: 0.7, craters: 0.55, cmax: 80, mtn: [15, 0.25], ridge: 1, seed: 132 },
    materials: [
      { n: 'Water-ice crust', c: '#b3e5fc', w: 6, comp: [['H₂O ice (crystalline)', 91], ['NH₃ hydrates', 6], ['Silicates', 2], ['Other', 1]], note: 'Ammonia-bearing ice from ancient cryovolcanic flooding.' },
      { n: 'Polar tholin cap', c: '#b0563d', w: 2, comp: [['H₂O ice', 55], ['Tholins', 38], ['NH₃ hydrates', 5], ['CH₄ (trapped)', 2]], note: 'Red stain from Pluto\'s escaped methane, as in Mordor Macula.' }
    ],
    desc: 'Half the diameter of Pluto. The two are locked face to face and orbit a point in the space between them — a true double world.',
    facts: [['Mutual tidal lock', 'Pluto and Charon keep the same faces toward each other'], ['Serenity Chasma', 'Canyon system 1,800 km long']]
  });
  B.push({
    id: 'haumea', name: 'Haumea', type: 'dwarf', parent: 'sun', R: 780, mass: 4.006e21,
    rotH: 3.9155, pole: [282.6, -13.0], pm: [0, 2206.6], color: '#d9d9d9',
    kep: { a: 43.116, e: 0.19642, i: 28.2137, O: 122.167, w: 239.041, M0: 218.205, ep: 7055.5, P: 103410 },
    temp: { min: 30, mean: 40, max: 50 }, landable: true, cls: 'Dwarf planet (Kuiper Belt)',
    terrain: { amp: 0.4, craters: 0.3, cmax: 60, seed: 141 },
    materials: [
      { n: 'Crystalline water ice', c: '#e3f2fd', w: 7, comp: [['H₂O ice (crystalline)', 73], ['H₂O ice (amorphous)', 22], ['HCN / clays', 5]], note: 'Unusually pure — likely exposed by an ancient giant collision.' },
      { n: 'Dark red spot material', c: '#bf6b53', w: 1, comp: [['H₂O ice', 70], ['Organics / irradiated minerals', 30]], note: 'A redder, darker region seen in its light curve.' }
    ],
    desc: 'A rugby-ball-shaped dwarf planet that spins once every 3.9 hours — the fastest rotation of any large body — and has a ring and two moons.',
    facts: [['True shape', 'Ellipsoid ≈ 2,100 × 1,680 × 1,074 km (modelled here as a sphere)'], ['Ring', 'Discovered 2017'], ['Surface map', 'Artist\'s impression — never imaged up close']]
  });
  B.push({
    id: 'makemake', name: 'Makemake', type: 'dwarf', parent: 'sun', R: 715, mass: 3.1e21,
    rotH: 22.8266, pole: [10, 50], pm: [0, 378.5], color: '#c98f6b',
    kep: { a: 45.430, e: 0.16126, i: 28.9835, O: 79.620, w: 294.834, M0: 165.514, ep: 7055.5, P: 111845 },
    temp: { min: 32, mean: 40, max: 44 }, landable: true, cls: 'Dwarf planet (Kuiper Belt)',
    terrain: { amp: 0.35, craters: 0.25, cmax: 60, seed: 142 }, materials: KBO,
    desc: 'A reddish Kuiper Belt dwarf planet covered in methane ice in pellets about a centimetre across.',
    facts: [['Surface map', 'Artist\'s impression — never imaged up close'], ['Spin axis', 'Unknown; assumed here']]
  });
  B.push({
    id: 'eris', name: 'Eris', type: 'dwarf', parent: 'sun', R: 1163, mass: 1.6466e22,
    rotH: 378.86, pole: [40, 30], pm: [0, 22.805], color: '#e3ded6',
    kep: { a: 67.864, e: 0.43607, i: 44.040, O: 35.951, w: 151.639, M0: 205.989, ep: 7055.5, P: 204199 },
    temp: { min: 30, mean: 42, max: 56 }, landable: true, cls: 'Dwarf planet (scattered disc)',
    terrain: { amp: 0.3, craters: 0.2, cmax: 60, seed: 143 }, materials: KBO,
    desc: 'The most massive known dwarf planet, currently three times farther out than Pluto. Its discovery in 2005 led to the reclassification of Pluto.',
    facts: [['Albedo', '0.96 — nearly as bright as fresh snow'], ['Orbit period', '559 years'], ['Surface map', 'Artist\'s impression — never imaged up close']]
  });

  window.SOLDATA = { AU: AU, G: G, BODIES: B };
})();
