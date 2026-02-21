import { describe, it, expect } from 'vitest';
import { softmax, computeTripCosts, computeModeSplit, runSimulation } from './simulator.js';

// ─── Mock data pour tests ────────────────────────────────────────────────────

const mockParking = [
  {
    zoneId: 'centre', capacity: 850, basePriceCHFh: 2.5,
    peakMultiplier: 1.6, offpeakMultiplier: 0.7,
    longStayShare: 0.35, frictionIndex: 0.72,
  },
  {
    zoneId: 'peripherie', capacity: 2200, basePriceCHFh: 0.0,
    peakMultiplier: 1.0, offpeakMultiplier: 1.0,
    longStayShare: 0.60, frictionIndex: 0.12,
  },
];

const mockTP = [
  {
    zoneId: 'centre', accessIndex: 0.90, timeToCenterMin: 0,
    peakFreqMin: 10, offpeakFreqMin: 20,
    ticketBaseCHF: 3.2, offpeakDiscountMax: 0.30,
  },
  {
    zoneId: 'peripherie', accessIndex: 0.25, timeToCenterMin: 35,
    peakFreqMin: 40, offpeakFreqMin: 90,
    ticketBaseCHF: 4.5, offpeakDiscountMax: 0.10,
  },
];

const mockPersona = {
  id: 'test01', label: 'Test Pendulaire', emoji: '🧪',
  description: 'test',
  valueOfTimeCHFh: 25,
  priceSensitivity: 0.6,
  scheduleRigidity: 0.7,
  tpAffinity: 0.4,
  carDependency: 0.7,
  typicalTrip: {
    fromZoneId: 'peripherie',
    toZoneId: 'centre',
    timeWindow: 'peak' as const,
    durationType: 'long' as const,
  },
  tags: ['pendulaire'],
  income: 'moyen' as const,
  alternatives: ['tp', 'covoiturage'],
};

const baseScenario = {
  centrePeakPriceCHFh: 2.5,
  centreOffpeakPriceCHFh: 1.5,
  peripheriePeakPriceCHFh: 0.0,
  peripherieOffpeakPriceCHFh: 0.0,
  progressiveSlopeFactor: 1.0,
  tpOffpeakDiscountPct: 0,
  enableCovoiturage: false,
  enableTAD: false,
  enableTaxiBons: false,
  objective: 'reduce-peak-car' as const,
};

// ─── Test 1: Cohérence softmax ───────────────────────────────────────────────

describe('softmax', () => {
  it('produit des probabilités qui somment à 1', () => {
    const costs = [5.0, 8.0, 12.0, 20.0, 15.0];
    const probs = softmax(costs);

    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('assign higher probability to lower cost', () => {
    const costs = [3.0, 8.0, 15.0];
    const probs = softmax(costs);
    
    // Le coût le plus bas doit avoir la prob la plus haute
    expect(probs[0]).toBeGreaterThan(probs[1]);
    expect(probs[1]).toBeGreaterThan(probs[2]);
  });

  it('toutes les probabilités sont entre 0 et 1', () => {
    const costs = [4.0, 6.0, 10.0, 25.0];
    const probs = softmax(costs);
    
    probs.forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });
});

// ─── Test 2: Hausse prix parking → shift voiture diminue ────────────────────

describe('simulation tarification', () => {
  it('une hausse du prix parking centre réduit la part voiture', () => {
    const mockPersonas = [mockPersona];

    const lowPriceScenario = { ...baseScenario, centrePeakPriceCHFh: 1.5 };
    const highPriceScenario = { ...baseScenario, centrePeakPriceCHFh: 5.0 };

    const resultsLow = runSimulation(lowPriceScenario, mockParking as any, mockTP as any, mockPersonas);
    const resultsHigh = runSimulation(highPriceScenario, mockParking as any, mockTP as any, mockPersonas);

    const centreLow = resultsLow.zoneResults.find(z => z.zoneId === 'centre');
    const centreHigh = resultsHigh.zoneResults.find(z => z.zoneId === 'centre');

    // La part voiture doit être plus basse avec un prix élevé
    if (centreLow && centreHigh) {
      expect(centreHigh.modeSplit.car).toBeLessThan(centreLow.modeSplit.car);
    }
  });

  it('shift global est plus élevé avec prix parking élevé', () => {
    const mockPersonas = [mockPersona];
    
    const baseResults = runSimulation(baseScenario, mockParking as any, mockTP as any, mockPersonas);
    const highPriceResults = runSimulation(
      { ...baseScenario, centrePeakPriceCHFh: 6.0 },
      mockParking as any, mockTP as any, mockPersonas
    );

    expect(highPriceResults.globalShiftIndex).toBeGreaterThanOrEqual(baseResults.globalShiftIndex);
  });
});

// ─── Test 3: Activation covoiturage améliore le shift ───────────────────────

describe('mesures alternatives', () => {
  it('activation covoiturage améliore le shift pour personas compatibles', () => {
    // Persona à faible rigidité = compatible covoiturage
    const flexPersona = {
      ...mockPersona,
      id: 'flex01',
      scheduleRigidity: 0.3, // faible rigidité
      carDependency: 0.6,
    };

    const withoutCovoiturage = runSimulation(
      { ...baseScenario, centrePeakPriceCHFh: 3.5, enableCovoiturage: false },
      mockParking as any, mockTP as any, [flexPersona]
    );

    const withCovoiturage = runSimulation(
      { ...baseScenario, centrePeakPriceCHFh: 3.5, enableCovoiturage: true },
      mockParking as any, mockTP as any, [flexPersona]
    );

    // Avec covoiturage, la part voiture seule doit diminuer
    const centreWithout = withoutCovoiturage.zoneResults.find(z => z.zoneId === 'centre');
    const centreWith = withCovoiturage.zoneResults.find(z => z.zoneId === 'centre');

    if (centreWithout && centreWith) {
      // Le shift index doit être >= sans covoiturage
      expect(centreWith.shiftIndex).toBeGreaterThanOrEqual(centreWithout.shiftIndex - 0.01);
      // La part covoiturage doit augmenter
      expect(centreWith.modeSplit.covoiturage).toBeGreaterThan(centreWithout.modeSplit.covoiturage);
    }
  });

  it('TAD activé réduit les coûts TP effectifs dans zones mal desservies', () => {
    const peripheralPersona = {
      ...mockPersona,
      typicalTrip: { ...mockPersona.typicalTrip, fromZoneId: 'peripherie', toZoneId: 'peripherie' },
    };

    const parking = mockParking.find(p => p.zoneId === 'peripherie')!;
    const tp = mockTP.find(t => t.zoneId === 'peripherie')!;

    const costsWithoutTAD = computeTripCosts(peripheralPersona, parking as any, tp as any, baseScenario, 'peripherie');
    const costsWithTAD = computeTripCosts(
      peripheralPersona, parking as any, tp as any,
      { ...baseScenario, enableTAD: true }, 'peripherie'
    );

    // TAD doit être disponible (pas Infinity) et avoir un coût raisonnable
    expect(costsWithoutTAD.tad).toBe(Infinity);
    expect(costsWithTAD.tad).not.toBe(Infinity);
    expect(costsWithTAD.tad).toBeLessThan(100);
  });
});
