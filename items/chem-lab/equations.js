/* Chemistry Lab: EVERY equation shown on screen lives here and only here (tests/check_equations.mjs checks each one).
   word:    the word equation (terms joined by " + ", sides by " → "; a note in brackets after a name is allowed)
   formula: the balanced chemical equation (coefficients, state symbols (s) (l) (g) (aq) allowed), shown small, "Class 10"
   names:   word term -> formula, used by the test to check the word and formula equations say the same thing.
   Facts as NCERT Class 10 Science ch 1 (eq. 1.24, 1.27) and ch 2 (Activities 2.3, 2.5, 2.6). */
export const NAMES = {
  'Sodium hydroxide': 'NaOH', 'Hydrochloric acid': 'HCl', 'Sodium chloride': 'NaCl', 'Water': 'H2O',
  'Zinc': 'Zn', 'Zinc chloride': 'ZnCl2', 'Hydrogen': 'H2', 'Oxygen': 'O2',
  'Iron': 'Fe', 'Copper sulphate': 'CuSO4', 'Iron sulphate': 'FeSO4', 'Copper': 'Cu',
  'Sodium sulphate': 'Na2SO4', 'Barium chloride': 'BaCl2', 'Barium sulphate': 'BaSO4',
  'Acetic acid': 'CH3COOH', 'Sodium hydrogencarbonate': 'NaHCO3', 'Sodium acetate': 'CH3COONa', 'Carbon dioxide': 'CO2',
  'Calcium hydroxide': 'Ca(OH)2', 'Calcium carbonate': 'CaCO3'
};
export const EQ = {
  indicators: { table: true },
  neutral: { eqs: [
    { word: 'Sodium hydroxide + Hydrochloric acid → Sodium chloride + Water', formula: 'NaOH(aq) + HCl(aq) → NaCl(aq) + H2O(l)' } ],
    note: 'Base + Acid → Salt + Water. Heat is given out.' },
  metal_acid: { eqs: [
    { word: 'Zinc + Hydrochloric acid → Zinc chloride + Hydrogen', formula: 'Zn(s) + 2HCl(aq) → ZnCl2(aq) + H2(g)' },
    { word: 'Hydrogen + Oxygen → Water', formula: '2H2(g) + O2(g) → 2H2O(l)' } ],
    note: 'Metal + Acid → Salt + Hydrogen gas. Hydrogen burns with a pop.' },
  displacement: { eqs: [
    { word: 'Iron + Copper sulphate → Iron sulphate + Copper', formula: 'Fe(s) + CuSO4(aq) → FeSO4(aq) + Cu(s)' } ],
    note: 'Iron is more reactive than copper, so it displaces copper.' },
  precipitation: { eqs: [
    { word: 'Sodium sulphate + Barium chloride → Barium sulphate (white precipitate) + Sodium chloride', formula: 'Na2SO4(aq) + BaCl2(aq) → BaSO4(s) + 2NaCl(aq)' } ],
    note: 'A double displacement reaction that forms a precipitate.' },
  co2: { eqs: [
    { word: 'Acetic acid (vinegar) + Sodium hydrogencarbonate (baking soda) → Sodium acetate + Water + Carbon dioxide', formula: 'CH3COOH(aq) + NaHCO3(s) → CH3COONa(aq) + H2O(l) + CO2(g)' },
    { word: 'Calcium hydroxide (lime water) + Carbon dioxide → Calcium carbonate (milky) + Water', formula: 'Ca(OH)2(aq) + CO2(g) → CaCO3(s) + H2O(l)' } ],
    note: 'Carbon dioxide turns lime water milky.' }
};
/* indicator colours (experiment 1): what each indicator shows in an acid and in a base */
export const INDICATORS = [
  { name: 'Blue litmus', acid: ['red', '#D23C4E'], base: ['stays blue', '#3F5FB5'] },
  { name: 'Red litmus', acid: ['stays red', '#D23C4E'], base: ['blue', '#3F5FB5'] },
  { name: 'Phenolphthalein', acid: ['colourless', '#FFFFFF'], base: ['pink', '#EE4DB4'] },
  { name: 'Turmeric', acid: ['stays yellow', '#EFB300'], base: ['red-brown', '#A8331C'] }
];
