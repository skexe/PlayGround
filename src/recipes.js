export const RECIPES = [
  { id: 'repair',   name: 'Reparación de casco',       desc: 'Restaura 35 puntos de vida.',            cost: { FERRITE: 15 },                    tech: 'SOPORTE VITAL' },
  { id: 'shield',   name: 'Célula de escudo',          desc: 'Restaura 50 puntos de escudo.',           cost: { SODIUM: 10 },                     tech: 'DEFENSA' },
  { id: 'oxygen',   name: 'Recarga de soporte',        desc: 'Restaura 55 de oxígeno.',                 cost: { OXYGEN: 8, CARBON: 8 },          tech: 'SOPORTE VITAL' },
  { id: 'warpcell', name: 'Célula de deformación',     desc: 'Combustible para un salto interestelar.', cost: { PARAFINIUM: 8, COBALT: 10 },       tech: 'HIPERIMPULSOR' },
  { id: 'fuel',     name: 'Combustible de lanzamiento',desc: 'Añade 2 cargas de despegue.',              cost: { DIHYDROGEN: 6 },                  tech: 'PROPULSIÓN' },
  { id: 'mining',   name: 'Amplificador de minero',    desc: 'Mejora permanente: +25% extracción.',      cost: { FERRITE: 30, COPPER: 6 },          tech: 'HERRAMIENTA' },
  { id: 'weapon',   name: 'Amplificador de fase',      desc: 'Mejora permanente: +40% daño.',            cost: { COPPER: 12, CHROMATIC: 4 },        tech: 'ARMAMENTO' },
  { id: 'hazard',   name: 'Blindaje ambiental',        desc: 'Mejora permanente: +20% resistencia.',     cost: { SODIUM: 20, EMERIL: 3 },           tech: 'TRAJE' },
];
