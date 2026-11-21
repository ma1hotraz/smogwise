/** The four sample profiles from docs/01 §2: one click shows a complete plan. */
import { NO_INDOOR_SOURCES, type Profile } from './schema/profile.js';

interface Sample {
  id: string;
  label: string;
  summary: string;
  profile: Profile;
}

export const SAMPLES: readonly Sample[] = [
  {
    id: 'sharma',
    label: 'The Sharma household, Delhi',
    summary: 'Toddler, grandmother with asthma, scooter commute, daily incense, no purifier',
    profile: {
      version: 1,
      location: {
        name: 'Delhi',
        admin1: 'National Capital Territory of Delhi',
        countryCode: 'IN',
        lat: 28.7,
        lon: 77.2,
        timezone: 'Asia/Kolkata',
      },
      household: {
        adults: 3,
        under5: 1,
        children: 0,
        over65: 1,
        pregnant: false,
        respiratory: true,
        heart: false,
      },
      lifestyle: {
        commute: { mode: 'two_wheeler', km: 12, daysPerWeek: 6, departHour: 9 },
        exercise: { kind: 'outdoor', hour: 6, minutes: 30 },
        cooking: 'lpg',
        heating: 'none',
        home: { tightness: 'leaky', roomM2: 16, purifierCadr: 0 },
        sources: { ...NO_INDOOR_SOURCES, incense: true, drySweeping: true },
        burnsWaste: false,
      },
    },
  },
  {
    id: 'ayesha',
    label: 'Ayesha, Lahore',
    summary: 'Student who cycles 6 km and runs at dawn; wood heater in a shared flat',
    profile: {
      version: 1,
      location: {
        name: 'Lahore',
        admin1: 'Punjab',
        countryCode: 'PK',
        lat: 31.5,
        lon: 74.3,
        timezone: 'Asia/Karachi',
      },
      household: {
        adults: 3,
        under5: 0,
        children: 0,
        over65: 0,
        pregnant: false,
        respiratory: false,
        heart: false,
      },
      lifestyle: {
        commute: { mode: 'cycle', km: 6, daysPerWeek: 5, departHour: 8 },
        exercise: { kind: 'outdoor', hour: 6, minutes: 40 },
        cooking: 'lpg',
        heating: 'wood',
        home: { tightness: 'average', roomM2: 12, purifierCadr: 0 },
        sources: { ...NO_INDOOR_SOURCES, mosquitoCoil: true },
        burnsWaste: false,
      },
    },
  },
  {
    id: 'chen',
    label: 'The Chen family, Beijing',
    summary: 'Works from home, one child, sealed flat with a 400 m³/h purifier',
    profile: {
      version: 1,
      location: {
        name: 'Beijing',
        admin1: 'Beijing',
        countryCode: 'CN',
        lat: 39.9,
        lon: 116.4,
        timezone: 'Asia/Shanghai',
      },
      household: {
        adults: 2,
        under5: 0,
        children: 1,
        over65: 0,
        pregnant: false,
        respiratory: false,
        heart: false,
      },
      lifestyle: {
        commute: { mode: 'wfh', km: 0, daysPerWeek: 0, departHour: 9 },
        exercise: { kind: 'indoor', hour: 18, minutes: 30 },
        cooking: 'induction',
        heating: 'electric',
        home: { tightness: 'sealed', roomM2: 20, purifierCadr: 400 },
        sources: NO_INDOOR_SOURCES,
        burnsWaste: false,
      },
    },
  },
  {
    id: 'rohit',
    label: 'Rohit, RWA volunteer, Gurugram',
    summary: 'Drives 18 km in a diesel car; society burns leaves; wants carpools',
    profile: {
      version: 1,
      location: {
        name: 'Gurugram',
        admin1: 'Haryana',
        countryCode: 'IN',
        lat: 28.5,
        lon: 77.0,
        timezone: 'Asia/Kolkata',
      },
      household: {
        adults: 2,
        under5: 0,
        children: 2,
        over65: 0,
        pregnant: false,
        respiratory: false,
        heart: false,
      },
      lifestyle: {
        commute: { mode: 'diesel_car', km: 18, daysPerWeek: 5, departHour: 8 },
        exercise: { kind: 'outdoor', hour: 19, minutes: 45 },
        cooking: 'lpg',
        heating: 'brazier',
        home: { tightness: 'average', roomM2: 18, purifierCadr: 150 },
        sources: { ...NO_INDOOR_SOURCES, smoking: true },
        burnsWaste: true,
      },
    },
  },
];
