/* Solar System Explorer — what the ground of each world is like.
   Adds to the bodies in data.js: landform recipes (terrain), close-up ground material (ground), named
   landing sites at real coordinates (sites) and which worlds have measured elevation data (dem).
   Longitudes are east-positive, -180..180, matching the colour maps (0° at the map centre). */
(function () {
  'use strict';
  const D = window.SOLDATA, by = {};
  D.BODIES.forEach(function (b) { by[b.id] = b; });
  const W = function (lonW) { let e = -lonW; while (e < -180) e += 360; return e; };       // west longitude -> east
  const E = function (lonE) { let e = lonE; while (e > 180) e -= 360; return e; };           // 0..360 east -> -180..180

  // close-up ground: g = [grain, crack network, pebbles], gloss = icy sheen, rock = boulder shape, rockK = how many boulders (0..1)
  const GROUND = {
    regolith: { g: [1.0, 0.0, 0.55], gloss: 0, rock: 'rock', rockK: 1 },
    dust:     { g: [0.8, 0.0, 0.25], gloss: 0, rock: 'rock', rockK: 0.5 },
    sand:     { g: [0.85, 0.0, 0.75], gloss: 0, rock: 'rock', rockK: 1, near: [0.78, 0.47, 0.29, 0.4] },
    cobble:   { g: [0.6, 0.0, 1.1], gloss: 0, rock: 'pebble', rockK: 1.3 },
    basalt:   { g: [0.75, 1.0, 0.2], gloss: 0, rock: 'lava', rockK: 0.8 },
    sulfur:   { g: [0.9, 0.55, 0.3], gloss: 0.05, rock: 'lava', rockK: 0.7 },
    ice:      { g: [0.5, 0.8, 0.12], gloss: 0.55, near: [0.86, 0.9, 0.96, 0.62], rock: 'ice', rockK: 0.9, rockTint: [0.92, 0.97, 1.05], rockLift: 0.25 },
    snow:     { g: [0.35, 0.3, 0.05], gloss: 0.7, near: [0.95, 0.97, 1.0, 0.7], rock: 'ice', rockK: 0.35, rockTint: [0.97, 1.0, 1.05], rockLift: 0.45 },
    icerock:  { g: [0.95, 0.3, 0.5], gloss: 0.14, rock: 'ice', rockK: 1, rockTint: [0.95, 0.98, 1.03], rockLift: 0.1 },
    nitro:    { g: [0.45, 0.7, 0.08], gloss: 0.35, near: [0.92, 0.9, 0.87, 0.3], rock: 'ice', rockK: 0.4, rockTint: [1.0, 0.98, 0.96], rockLift: 0.3 },
    earth:    { g: [1.0, 0.0, 0.35], gloss: 0, rock: 'rock', rockK: 0.5 }
  };
  function set(id, o) {
    const b = by[id]; if (!b) return;
    if (o.terrain) b.terrain = Object.assign({}, b.terrain, o.terrain);
    b.ground = GROUND[o.ground || 'regolith'];
    if (o.sites) b.sites = o.sites;
    if (o.dem) b.dem = o.dem;
    if (o.plumes) b.plumes = o.plumes;
  }
  const site = function (name, lat, lon, note) { return { name: name, lat: lat, lon: lon, note: note || '' }; };

  // ---------------- worlds with measured global elevation (see dem/meta.js)
  set('mercury', { dem: 1, ground: 'regolith', sites: [
    site('Caloris Basin', 31.5, 162.7, 'One of the biggest impact basins in the solar system, 1,550 km wide.'),
    site('Rachmaninoff crater', 27.6, 57.6, 'A double-ring basin with some of the lowest ground on Mercury.'),
    site('North polar craters', 84.5, 40, 'Permanently shadowed crater floors here hold water ice.')] });
  set('venus', { dem: 1, ground: 'basalt', sites: [
    site('Venera 13 landing site', -7.5, E(303.0), 'A Soviet lander survived 127 minutes here in 1982 and photographed flat basalt slabs.'),
    site('Maxwell Montes', 65.2, 3.3, 'The highest mountains on Venus, 11 km above the plains.'),
    site('Maat Mons', 0.5, E(194.6), 'A giant shield volcano 8 km high.')] });
  set('earth', { dem: 1, ground: 'earth', sites: [
    site('Kennedy Space Center', 28.6082, -80.6041, 'Launch Complex 39A, where Apollo 11 left for the Moon.'),
    site('Sahara Desert', 23.4, 12.6, 'The largest hot desert on Earth.'),
    site('Himalaya, near Everest', 28.1, 86.8, 'The roof of the world. Everest stands 8,849 m above sea level.'),
    site('Amazon rainforest', -3.4, -62.2, 'The biggest rainforest on Earth, seen here only as green ground.'),
    site('Antarctic ice sheet', -78.5, 106.8, 'Ice up to 4 km thick. Lake Vostok lies underneath.')] });
  set('moon', { dem: 1, ground: 'regolith', sites: [
    site('Tranquility Base', 0.674, 23.473, 'Apollo 11 landed here on 20 July 1969.'),
    site('Tycho crater', -43.0, -10.6, 'A young, bright crater 85 km wide and 4.7 km deep.'),
    site('Hadley Rille', 26.1, 3.6, 'Apollo 15 drove a rover beside this lava channel under the Apennine mountains.'),
    site('Copernicus crater', 9.9, -19.6, 'A 93 km crater with terraced walls and central peaks.'),
    site('South Pole – Aitken basin', -55, -165, 'The oldest and deepest basin on the Moon, on the far side.')] });
  set('mars', { dem: 1, ground: 'sand', terrain: { dunes: [0.18, 0.009] }, sites: [
    site('Jezero crater', 18.44, 77.45, 'An ancient lake and river delta. The Perseverance rover landed here in 2021.'),
    site('Olympus Mons summit', 18.4, W(133.3), 'The tallest volcano in the solar system: 21.9 km high.'),
    site('Valles Marineris', -13.9, W(59.2), 'A canyon system 4,000 km long and up to 7 km deep.'),
    site('Gale crater', -4.59, 137.44, 'The Curiosity rover has been exploring here since 2012.'),
    site('North polar cap', 86, -30, 'Layers of water ice and dust, topped with carbon dioxide frost in winter.')] });
  set('ceres', { dem: 1, ground: 'dust', sites: [
    site('Occator crater', 19.82, E(239.33), 'Bright salt deposits left by brine that seeped up from below.'),
    site('Ahuna Mons', -10.5, E(316.2), 'A lonely ice volcano 4 km high.')] });

  // ---------------- Mars' moons
  set('phobos', { ground: 'dust', terrain: { feat: [{ type: 'crater', lat: 1, lon: W(49), r: 4.5, depth: 1.1, rim: 0.15 }] },
    sites: [site('Stickney crater rim', 6, W(28), 'Stickney is 9 km wide, almost half the width of Phobos itself.')] });
  set('deimos', { ground: 'dust', sites: [site('Smooth plains', 20, 10, 'Deimos is covered in a thick blanket of fine dust.')] });

  // ---------------- Jupiter's moons
  set('io', { ground: 'sulfur',
    terrain: { amp: 0.22, craters: 0, paterae: { c: 520, dens: 80, depth: 1.3, dark: 0.17, flow: 26 }, stain: [0.3, 0.24, 0.2], stainMat: 2, useAlb: 1,
      patch: [1.12, 1.04, 0.72, 5, -0.25], hue: 2.2,
      feat: [{ type: 'mount', lat: -9.7, lon: W(270.1), r: 70, h: 15 }, { type: 'mount', lat: 12.2, lon: W(97.7), r: 55, h: 9 }] },
    sites: [
      site('Loki Patera', 14.6, W(306.4), 'A lava lake 200 km across, the most powerful volcano in the solar system.'),
      site('Pele', -19.8, W(254.2), 'A volcano that sprays a red sulfur ring 1,200 km wide.'),
      site('Boösaule Montes', -8.6, W(268.6), 'The tallest mountain on Io, about 17 km high.')] });
  set('europa', { ground: 'ice',
    terrain: { amp: 0.035, craters: 0.006, cmax: 14, mtn: null, hue: 0.5,
      lineae: [[230, 0.22, 2.6, 190], [50, 0.14, 0.95, 205], [10, 0.075, 0.26, 215], [1.9, 0.034, 0.065, 220], [0.34, 0.012, 0.014, 220], [0.06, 0.003, 0.003, 210]],
      chaos: { scale: 620, cell: 5.5, h: 0.11, cover: 0.3 },
      stain: [0.84, 0.66, 0.54], stainMat: 1, patch: [0.95, 0.985, 1.05, 0.5, -0.3] },
    sites: [
      site('Conamara Chaos', 9.7, W(272.7), 'Rafts of broken ice that drifted and froze again, like icebergs.'),
      site('Pwyll crater', -25.2, W(271.4), 'A young crater whose bright rays cross a thousand kilometres.'),
      site('Rhadamanthys Linea', 18.5, W(200.8), 'One of the long double ridges that criss-cross Europa.')] });
  set('ganymede', { ground: 'icerock',
    terrain: { useAlb: 1, mtn: null, grooves: { region: 620, lam: 8.5, h: 0.4, cover: 0.5, byAlb: 0.47 } },
    sites: [
      site('Uruk Sulcus', 0.8, W(160.3), 'Bright grooved terrain: belts of parallel ridges and valleys.'),
      site('Galileo Regio', 47, W(129.6), 'Dark, ancient, heavily cratered ground.'),
      site('Tros crater', 11.1, W(27.3), 'A bright ray crater 94 km wide.')] });
  set('callisto', { ground: 'icerock',
    terrain: { feat: [{ type: 'rings', lat: 14.7, lon: W(56), r: 1500, lam: 62, h: 0.5 }] },
    sites: [
      site('Valhalla', 16, W(58.5), 'A bull’s-eye of rings 3,800 km across, left by a giant impact.'),
      site('Asgard', 32.2, W(139.9), 'The second-largest ring structure on Callisto.')] });

  // ---------------- Saturn's moons
  set('mimas', { ground: 'icerock',
    terrain: { feat: [{ type: 'crater', lat: -1.4, lon: W(111.8), r: 69.5, depth: 9, rim: 2.2, peak: 6 }] },
    sites: [site('Herschel crater', -1.9, W(107), 'A crater a third as wide as Mimas, with a 6 km central peak.')] });
  set('enceladus', { ground: 'snow',
    terrain: { amp: 0.09, craters: 0.1, mtn: null, hue: 0.4, stain: [0.66, 0.9, 1.16], stainMat: 1,
      grooves: { region: 140, lam: 2.4, h: 0.13, cover: 0.55, stain: 0.45 },
      feat: [{ type: 'canyon', lat: -89.6, lon: 0, az: 35, len: 135, w: 1.1, depth: 0.5, rim: 0.13, n: 4, gap: 32, stain: 1 }] },
    plumes: 1,
    sites: [
      site('Tiger stripes, south pole', -88.9, 150, 'Cracks that spray jets of water ice from the ocean below. The Sun stays low in the sky here.'),
      site('Labtayt Sulci', -27, W(287), 'A canyon one kilometre deep.')] });
  set('tethys', { ground: 'icerock',
    terrain: { feat: [{ type: 'crater', lat: 32.8, lon: W(128.9), r: 222, depth: 3.5, rim: 1.6, peak: 2.5 }, { type: 'canyon', lat: -5, lon: W(8), az: 8, len: 1500, w: 34, depth: 3.5, rim: 0.4 }] },
    sites: [site('Odysseus crater', 30, W(120), 'A basin 445 km wide.'), site('Ithaca Chasma', -4, W(11), 'A canyon that runs three-quarters of the way round Tethys.')] });
  set('dione', { ground: 'icerock',
    terrain: { feat: [{ type: 'canyon', lat: 5, lon: W(285), az: 20, len: 700, w: 9, depth: 1.4, rim: 0.2, n: 3, gap: 9, stain: 1 }], stain: [1.25, 1.3, 1.35] },
    sites: [site('Wispy ice cliffs', 6, W(281), 'Bright fractures hundreds of metres high.')] });
  set('rhea', { ground: 'icerock', sites: [site('Inktomi crater', -14.1, W(112.1), 'A fresh crater with bright rays.')] });
  set('titan', { ground: 'cobble',
    terrain: { useAlb: 1, dunes: [2.6, 0.1, 0.4] },
    sites: [
      site('Huygens landing site', -10.57, W(192.34), 'The Huygens probe landed here in 2005 among rounded pebbles of water ice.'),
      site('Shangri-La sand sea', -6, W(165), 'Dunes of dark organic sand 100 m high. NASA’s Dragonfly will land near here.'),
      site('Shore of Kraken Mare', 62, W(300), 'A sea of liquid methane and ethane larger than the Caspian Sea.')] });
  set('iapetus', { ground: 'icerock',
    terrain: { feat: [{ type: 'eqridge', lon: W(90), span: 250, w: 9, h: 13 }] },
    sites: [site('Equatorial ridge', 3.0, 18, 'A mountain wall up to 20 km high that follows the equator.'), site('Bright side', 20, W(270), 'The trailing half of Iapetus is as bright as snow.')] });

  // ---------------- Uranus' moons
  set('miranda', { ground: 'icerock',
    terrain: { mtn: null, grooves: { region: 170, lam: 4.5, h: 0.5, cover: 0.45 }, feat: [{ type: 'scarp', lat: -18.3, lon: E(347.7), az: 25, len: 116, w: 1.3, h: 10 }] },
    sites: [site('Verona Rupes', -18.7, E(349.5), 'The tallest cliff known anywhere: perhaps 20 km high.'), site('Inverness Corona', -66.9, E(325.7), 'A patch of ridges shaped like a chevron.')] });
  set('ariel', { ground: 'icerock', terrain: { feat: [{ type: 'canyon', lat: -33.7, lon: E(246), az: 310, len: 620, w: 13, depth: 3, rim: 0.3 }] },
    sites: [site('Kachina Chasmata', -32.5, E(248), 'Rift valleys with smooth, flooded floors.')] });
  set('umbriel', { ground: 'icerock', sites: [site('Wunda crater', -7.9, E(273.6), 'A crater with a mysterious bright ring on its floor.')] });
  set('titania', { ground: 'icerock', terrain: { feat: [{ type: 'canyon', lat: -33.3, lon: E(335), az: 330, len: 1490, w: 16, depth: 3, rim: 0.3 }] },
    sites: [site('Messina Chasmata', -32, E(337), 'A canyon 1,500 km long.')] });
  set('oberon', { ground: 'icerock', terrain: { feat: [{ type: 'crater', lat: -46.1, lon: 44.4, r: 103, depth: 3.5, rim: 1.2, peak: 2.5 }] },
    sites: [site('Hamlet crater', -45, 47, 'A 206 km crater with a dark floor.')] });

  // ---------------- Neptune's moons
  set('proteus', { ground: 'dust', sites: [site('Pharos basin', -10, 10, 'A crater so large it nearly broke Proteus apart.')] });
  set('triton', { ground: 'nitro',
    terrain: { mtn: null, craters: 0.015, cells: { c: 34, depth: 0.28, rim: 0.2, cover: 0.5 }, hue: 0.6, patch: [1.08, 0.96, 0.94, 30, -0.2] },
    sites: [site('Cantaloupe terrain', 12, 15, 'Dimpled ground that looks like the skin of a melon.'), site('South polar cap geysers', -50, 25, 'Voyager 2 saw dark plumes of nitrogen rising 8 km here.')] });

  // ---------------- Pluto system and the outer dwarfs
  set('pluto', { ground: 'nitro', dem: 1,
    terrain: { poly: { c: 30, depth: 0.1 }, stain: [0.78, 0.72, 0.66], hue: 0.7, demRough: 0.6,
      feat: [{ type: 'basin', lat: 22, lon: 178, r: 430, h: 0 }] },
    sites: [
      site('Sputnik Planitia', 21, 177, 'A glacier of frozen nitrogen 1,000 km wide, churning in slow polygons.'),
      site('Tenzing Montes', -14.2, 177.5, 'Mountains of water ice as hard as rock, up to 6 km high.'),
      site('Cthulhu Macula', -8, 110, 'A dark red region coated in tholins.')] });
  set('charon', { ground: 'icerock',
    terrain: { feat: [{ type: 'canyon', lat: 18, lon: 8, az: 75, len: 700, w: 26, depth: 5, rim: 0.5 }] },
    sites: [site('Serenity Chasma', 21.5, 4, 'A canyon wider and deeper than the Grand Canyon.'), site('Vulcan Planitia', -10, 5, 'Smooth plains of frozen water-ammonia lava.')] });
  ['haumea', 'makemake', 'eris'].forEach(function (id) { set(id, { ground: 'nitro', sites: [site('Frost plains', 10, 20, 'No spacecraft has visited. The map colours are an artist’s impression.')] }); });

  D.BODIES.forEach(function (b) { if (b.landable && !b.ground) b.ground = GROUND.regolith; });
  D.GROUND = GROUND;
})();
