/**
 * Location Database for GROUP 2B WebSearch Enhancement
 * Contains common misspellings, abbreviations, and regional variations
 */

export interface LocationCorrection {
  correct: string;
  variations: string[];
  type: 'city' | 'state' | 'region';
  metadata?: {
    state?: string;
    population?: number;
    zipCodes?: string[];
  };
}

export interface StateInfo {
  name: string;
  abbreviation: string;
  variations: string[];
  majorCities: string[];
  regionalTerms: string[];
}

export interface ServiceTerminology {
  region: string;
  terms: {
    [service: string]: string[];
  };
}

export class LocationDatabase {
  // Common city misspellings
  private static readonly CITY_CORRECTIONS: LocationCorrection[] = [
    {
      correct: 'Philadelphia',
      variations: ['Philidelphia', 'Philly', 'Philadephia', 'Philidelphia', 'Filadelphia', 'Philladelphia'],
      type: 'city',
      metadata: {
        state: 'Pennsylvania',
        population: 1603797,
        zipCodes: ['19019', '19092', '19093', '19099', '19101-19155']
      }
    },
    {
      correct: 'Pittsburgh',
      variations: ['Pittsburg', 'Pitsburgh', 'Pittsberg', 'Pitsburg'],
      type: 'city',
      metadata: {
        state: 'Pennsylvania',
        population: 302971
      }
    },
    {
      correct: 'Los Angeles',
      variations: ['LA', 'L.A.', 'Los Angelos', 'Los Angles', 'Los Angelis'],
      type: 'city',
      metadata: {
        state: 'California',
        population: 3979576
      }
    },
    {
      correct: 'San Francisco',
      variations: ['SF', 'S.F.', 'San Fran', 'Frisco', 'San Fransisco', 'San Franciso'],
      type: 'city',
      metadata: {
        state: 'California',
        population: 881549
      }
    },
    {
      correct: 'New York',
      variations: ['NYC', 'NY', 'N?.Y?.C.', 'New York City', 'Newyork', 'The City'],
      type: 'city',
      metadata: {
        state: 'New York',
        population: 8336817
      }
    },
    {
      correct: 'Chicago',
      variations: ['Chi-town', 'Chicgo', 'Chcago', 'Chitown', 'The Windy City'],
      type: 'city',
      metadata: {
        state: 'Illinois',
        population: 2693976
      }
    },
    {
      correct: 'Houston',
      variations: ['Housten', 'Huston', 'H-town', 'Space City'],
      type: 'city',
      metadata: {
        state: 'Texas',
        population: 2320268
      }
    },
    {
      correct: 'Phoenix',
      variations: ['Pheonix', 'Phenix', 'PHX'],
      type: 'city',
      metadata: {
        state: 'Arizona',
        population: 1680992
      }
    },
    {
      correct: 'Miami',
      variations: ['Maiami', 'MIA', 'Magic City'],
      type: 'city',
      metadata: {
        state: 'Florida',
        population: 467963
      }
    },
    {
      correct: 'Boston',
      variations: ['Beantown', 'Bostin', 'Bosten', 'BOS'],
      type: 'city',
      metadata: {
        state: 'Massachusetts',
        population: 692600
      }
    },
    {
      correct: 'Seattle',
      variations: ['Seatle', 'Seatel', 'SEA', 'Emerald City'],
      type: 'city',
      metadata: {
        state: 'Washington',
        population: 753675
      }
    },
    {
      correct: 'Denver',
      variations: ['Mile High City', 'Dever', 'DEN'],
      type: 'city',
      metadata: {
        state: 'Colorado',
        population: 727211
      }
    },
    {
      correct: 'Minneapolis',
      variations: ['Mineapolis', 'Minneapols', 'Twin Cities', 'MPLS'],
      type: 'city',
      metadata: {
        state: 'Minnesota',
        population: 429606
      }
    },
    {
      correct: 'Cincinnati',
      variations: ['Cincinatti', 'Cincinnatti', 'Cincy', 'Cinci'],
      type: 'city',
      metadata: {
        state: 'Ohio',
        population: 303940
      }
    },
    {
      correct: 'Albuquerque',
      variations: ['Alberquerque', 'Albuqerque', 'ABQ', 'Albuquerqe'],
      type: 'city',
      metadata: {
        state: 'New Mexico',
        population: 560513
      }
    }
  ];

  // State information and variations
  private static readonly STATE_INFO: StateInfo[] = [
    {
      name: 'Alabama',
      abbreviation: 'AL',
      variations: ['Ala', 'Ala.', 'Albama'],
      majorCities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville'],
      regionalTerms: ['Heart of Dixie', 'Yellowhammer State']
    },
    {
      name: 'Alaska',
      abbreviation: 'AK',
      variations: ['Alas', 'Alask'],
      majorCities: ['Anchorage', 'Fairbanks', 'Juneau'],
      regionalTerms: ['The Last Frontier', 'Land of the Midnight Sun']
    },
    {
      name: 'Arizona',
      abbreviation: 'AZ',
      variations: ['Ariz', 'Ariz.', 'Arizon'],
      majorCities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler'],
      regionalTerms: ['Grand Canyon State', 'Copper State']
    },
    {
      name: 'Arkansas',
      abbreviation: 'AR',
      variations: ['Ark', 'Ark.', 'Arkansaw'],
      majorCities: ['Little Rock', 'Fort Smith', 'Fayetteville'],
      regionalTerms: ['Natural State', 'Land of Opportunity']
    },
    {
      name: 'California',
      abbreviation: 'CA',
      variations: ['Cal', 'Calif', 'Calif.', 'Cali'],
      majorCities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose'],
      regionalTerms: ['Golden State', 'Bear Republic']
    },
    {
      name: 'Colorado',
      abbreviation: 'CO',
      variations: ['Col', 'Colo', 'Colo.'],
      majorCities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'],
      regionalTerms: ['Centennial State', 'Colorful Colorado']
    },
    {
      name: 'Connecticut',
      abbreviation: 'CT',
      variations: ['Conn', 'Conn.', 'Conneticut'],
      majorCities: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford'],
      regionalTerms: ['Constitution State', 'Nutmeg State']
    },
    {
      name: 'Delaware',
      abbreviation: 'DE',
      variations: ['Del', 'Del.', 'Deleware'],
      majorCities: ['Wilmington', 'Dover', 'Newark'],
      regionalTerms: ['First State', 'Diamond State']
    },
    {
      name: 'Florida',
      abbreviation: 'FL',
      variations: ['Fla', 'Fla.', 'Flor'],
      majorCities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville'],
      regionalTerms: ['Sunshine State', 'Peninsula State']
    },
    {
      name: 'Georgia',
      abbreviation: 'GA',
      variations: ['Ga.', 'Georg'],
      majorCities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah'],
      regionalTerms: ['Peach State', 'Empire State of the South']
    },
    {
      name: 'Hawaii',
      abbreviation: 'HI',
      variations: ['Haw', 'Hawai'],
      majorCities: ['Honolulu', 'Hilo', 'Kailua', 'Pearl City'],
      regionalTerms: ['Aloha State', 'Paradise of the Pacific']
    },
    {
      name: 'Idaho',
      abbreviation: 'ID',
      variations: ['Ida', 'Idah'],
      majorCities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
      regionalTerms: ['Gem State', 'Potato State']
    },
    {
      name: 'Illinois',
      abbreviation: 'IL',
      variations: ['Ill', 'Ill.', 'Ilinois'],
      majorCities: ['Chicago', 'Aurora', 'Rockford', 'Joliet'],
      regionalTerms: ['Prairie State', 'Land of Lincoln']
    },
    {
      name: 'Indiana',
      abbreviation: 'IN',
      variations: ['Ind', 'Ind.', 'Indianna'],
      majorCities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend'],
      regionalTerms: ['Hoosier State', 'Crossroads of America']
    },
    {
      name: 'Iowa',
      abbreviation: 'IA',
      variations: ['Iow', 'Ia.'],
      majorCities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City'],
      regionalTerms: ['Hawkeye State', 'Corn State']
    },
    {
      name: 'Kansas',
      abbreviation: 'KS',
      variations: ['Kan', 'Kans', 'Kan.'],
      majorCities: ['Wichita', 'Overland Park', 'Kansas City', 'Topeka'],
      regionalTerms: ['Sunflower State', 'Wheat State']
    },
    {
      name: 'Kentucky',
      abbreviation: 'KY',
      variations: ['Ken', 'Kent', 'Ky.'],
      majorCities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro'],
      regionalTerms: ['Bluegrass State', 'Bourbon State']
    },
    {
      name: 'Louisiana',
      abbreviation: 'LA',
      variations: ['La.', 'Louis', 'Louisianna'],
      majorCities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
      regionalTerms: ['Pelican State', 'Bayou State', 'Creole State']
    },
    {
      name: 'Maine',
      abbreviation: 'ME',
      variations: ['Me.', 'Main'],
      majorCities: ['Portland', 'Lewiston', 'Bangor', 'Augusta'],
      regionalTerms: ['Pine Tree State', 'Vacationland']
    },
    {
      name: 'Maryland',
      abbreviation: 'MD',
      variations: ['Md.', 'Mary'],
      majorCities: ['Baltimore', 'Columbia', 'Germantown', 'Silver Spring'],
      regionalTerms: ['Old Line State', 'Free State']
    },
    {
      name: 'Massachusetts',
      abbreviation: 'MA',
      variations: ['Mass', 'Mass.', 'Massachusets'],
      majorCities: ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
      regionalTerms: ['Bay State', 'Old Colony State']
    },
    {
      name: 'Michigan',
      abbreviation: 'MI',
      variations: ['Mich', 'Mich.', 'Michagan'],
      majorCities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights'],
      regionalTerms: ['Great Lakes State', 'Wolverine State']
    },
    {
      name: 'Minnesota',
      abbreviation: 'MN',
      variations: ['Minn', 'Minn.', 'Minnesotta'],
      majorCities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth'],
      regionalTerms: ['North Star State', 'Land of 10,000 Lakes']
    },
    {
      name: 'Mississippi',
      abbreviation: 'MS',
      variations: ['Miss', 'Miss.', 'Missippi'],
      majorCities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg'],
      regionalTerms: ['Magnolia State', 'Hospitality State']
    },
    {
      name: 'Missouri',
      abbreviation: 'MO',
      variations: ['Mo.', 'Missour'],
      majorCities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
      regionalTerms: ['Show Me State', 'Cave State']
    },
    {
      name: 'Montana',
      abbreviation: 'MT',
      variations: ['Mont', 'Mont.'],
      majorCities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman'],
      regionalTerms: ['Treasure State', 'Big Sky Country']
    },
    {
      name: 'Nebraska',
      abbreviation: 'NE',
      variations: ['Neb', 'Nebr', 'Neb.'],
      majorCities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
      regionalTerms: ['Cornhusker State', 'Beef State']
    },
    {
      name: 'Nevada',
      abbreviation: 'NV',
      variations: ['Nev', 'Nev.'],
      majorCities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas'],
      regionalTerms: ['Silver State', 'Battle Born State']
    },
    {
      name: 'New Hampshire',
      abbreviation: 'NH',
      variations: ['N.H.', 'New Hamp'],
      majorCities: ['Manchester', 'Nashua', 'Concord', 'Dover'],
      regionalTerms: ['Granite State', 'White Mountain State']
    },
    {
      name: 'New Jersey',
      abbreviation: 'NJ',
      variations: ['N.J.', 'Jersey'],
      majorCities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth'],
      regionalTerms: ['Garden State', 'Jersey']
    },
    {
      name: 'New Mexico',
      abbreviation: 'NM',
      variations: ['N.M.', 'N. Mex', 'New Mex'],
      majorCities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe'],
      regionalTerms: ['Land of Enchantment', 'Sunshine State']
    },
    {
      name: 'New York',
      abbreviation: 'NY',
      variations: ['N.Y.', 'NewYork'],
      majorCities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers'],
      regionalTerms: ['Empire State', 'Excelsior State']
    },
    {
      name: 'North Carolina',
      abbreviation: 'NC',
      variations: ['N.C.', 'N. Car', 'No. Carolina'],
      majorCities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham'],
      regionalTerms: ['Tar Heel State', 'Old North State']
    },
    {
      name: 'North Dakota',
      abbreviation: 'ND',
      variations: ['N.D.', 'N. Dak', 'No. Dakota'],
      majorCities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
      regionalTerms: ['Peace Garden State', 'Roughrider State']
    },
    {
      name: 'Ohio',
      abbreviation: 'OH',
      variations: ['O.', 'Ohi'],
      majorCities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
      regionalTerms: ['Buckeye State', 'Birthplace of Aviation']
    },
    {
      name: 'Oklahoma',
      abbreviation: 'OK',
      variations: ['Okla', 'Okla.', 'Oklahome'],
      majorCities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow'],
      regionalTerms: ['Sooner State', 'Native America']
    },
    {
      name: 'Oregon',
      abbreviation: 'OR',
      variations: ['Ore', 'Oreg', 'Ore.'],
      majorCities: ['Portland', 'Eugene', 'Salem', 'Gresham'],
      regionalTerms: ['Beaver State', 'Pacific Wonderland']
    },
    {
      name: 'Pennsylvania',
      abbreviation: 'PA',
      variations: ['Pa.', 'Penn', 'Pennsylvnia'],
      majorCities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'],
      regionalTerms: ['Keystone State', 'Quaker State']
    },
    {
      name: 'Rhode Island',
      abbreviation: 'RI',
      variations: ['R.I.', 'Rhode Is'],
      majorCities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket'],
      regionalTerms: ['Ocean State', 'Little Rhody']
    },
    {
      name: 'South Carolina',
      abbreviation: 'SC',
      variations: ['S.C.', 'S. Car', 'So. Carolina'],
      majorCities: ['Columbia', 'Charleston', 'North Charleston', 'Mount Pleasant'],
      regionalTerms: ['Palmetto State', 'Smiling Faces State']
    },
    {
      name: 'South Dakota',
      abbreviation: 'SD',
      variations: ['S.D.', 'S. Dak', 'So. Dakota'],
      majorCities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings'],
      regionalTerms: ['Mount Rushmore State', 'Coyote State']
    },
    {
      name: 'Tennessee',
      abbreviation: 'TN',
      variations: ['Tenn', 'Tenn.', 'Tenessee'],
      majorCities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
      regionalTerms: ['Volunteer State', 'Big Bend State']
    },
    {
      name: 'Texas',
      abbreviation: 'TX',
      variations: ['Tex', 'Tex.'],
      majorCities: ['Houston', 'San Antonio', 'Dallas', 'Austin'],
      regionalTerms: ['Lone Star State', 'Beef State']
    },
    {
      name: 'Utah',
      abbreviation: 'UT',
      variations: ['Ut.'],
      majorCities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan'],
      regionalTerms: ['Beehive State', 'Mormon State']
    },
    {
      name: 'Vermont',
      abbreviation: 'VT',
      variations: ['Vt.', 'Verm'],
      majorCities: ['Burlington', 'South Burlington', 'Rutland', 'Barre'],
      regionalTerms: ['Green Mountain State', 'Maple State']
    },
    {
      name: 'Virginia',
      abbreviation: 'VA',
      variations: ['Va.', 'Virg'],
      majorCities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond'],
      regionalTerms: ['Old Dominion', 'Mother of Presidents']
    },
    {
      name: 'Washington',
      abbreviation: 'WA',
      variations: ['Wash', 'Wash.', 'Wa.'],
      majorCities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver'],
      regionalTerms: ['Evergreen State', 'Chinook State']
    },
    {
      name: 'West Virginia',
      abbreviation: 'WV',
      variations: ['W.V.', 'W. Va', 'W. Virg'],
      majorCities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg'],
      regionalTerms: ['Mountain State', 'Panhandle State']
    },
    {
      name: 'Wisconsin',
      abbreviation: 'WI',
      variations: ['Wis', 'Wisc', 'Wis.'],
      majorCities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha'],
      regionalTerms: ['Badger State', 'Dairy State', 'Cheese State']
    },
    {
      name: 'Wyoming',
      abbreviation: 'WY',
      variations: ['Wyo', 'Wyo.'],
      majorCities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette'],
      regionalTerms: ['Equality State', 'Cowboy State']
    }
  ];

  // Regional service terminology
  private static readonly SERVICE_TERMINOLOGY: ServiceTerminology[] = [
    {
      region: 'Northeast',
      terms: {
        plumbing: ['plumber', 'pipe fitter', 'water works'],
        electrical: ['electrician', 'sparky', 'electrical contractor'],
        hvac: ['HVAC', 'heating and cooling', 'climate control'],
        roofing: ['roofer', 'roofing contractor', 'shingle specialist'],
        locksmith: ['locksmith', 'lock service', 'key maker']
      }
    },
    {
      region: 'South',
      terms: {
        plumbing: ['plumber', 'pipe specialist', 'water line service'],
        electrical: ['electrician', 'electrical service', 'power specialist'],
        hvac: ['AC repair', 'air conditioning', 'cooling service'],
        roofing: ['roofer', 'roof repair', 'storm damage repair'],
        locksmith: ['locksmith', 'lock and key', 'security service']
      }
    },
    {
      region: 'Midwest',
      terms: {
        plumbing: ['plumber', 'plumbing service', 'drain cleaner'],
        electrical: ['electrician', 'electrical repair', 'wiring service'],
        hvac: ['furnace repair', 'heating service', 'HVAC'],
        roofing: ['roofer', 'roof contractor', 'siding and roofing'],
        locksmith: ['locksmith', 'lock repair', 'key service']
      }
    },
    {
      region: 'West',
      terms: {
        plumbing: ['plumber', 'plumbing contractor', 'water specialist'],
        electrical: ['electrician', 'electrical tech', 'power service'],
        hvac: ['HVAC', 'air and heat', 'climate service'],
        roofing: ['roofer', 'roofing service', 'tile specialist'],
        locksmith: ['locksmith', 'security specialist', 'access control']
      }
    },
    {
      region: 'Southwest',
      terms: {
        plumbing: ['plumber', 'fontanero', 'plumbing repair'],
        electrical: ['electrician', 'electricista', 'electrical work'],
        hvac: ['AC service', 'cooling repair', 'swamp cooler service'],
        roofing: ['roofer', 'techador', 'flat roof specialist'],
        locksmith: ['locksmith', 'cerrajero', 'lock expert']
      }
    }
  ];

  /**
   * Correct location spelling
   */
  public static correctLocation(input: string): { corrected: string; confidence: number } {
    const lowerInput = input.toLowerCase().trim();
    
    // Check cities
    for (const city of this.CITY_CORRECTIONS) {
      if (city?.variations?.some(v => v.toLowerCase() === lowerInput)) {
        return { corrected: city.correct, confidence: 0.9 };
      }
      
      // Fuzzy match
      for (const variation of city.variations) {
        if (this.fuzzyMatch(lowerInput, variation.toLowerCase())) {
          return { corrected: city.correct, confidence: 0.7 };
        }
      }
    }
    
    // Check states
    for (const state of this.STATE_INFO) {
      if (state?.variations?.some(v => v.toLowerCase() === lowerInput) || 
          state?.abbreviation?.toLowerCase() === lowerInput) {
        return { corrected: state.name, confidence: 0.9 };
      }
      
      // Check regional terms
      if (state?.regionalTerms?.some(term => term.toLowerCase() === lowerInput)) {
        return { corrected: state.name, confidence: 0.8 };
      }
    }
    
    return { corrected: input, confidence: 0.5 };
  }

  /**
   * Get state abbreviation
   */
  public static getStateAbbreviation(state: string): string | null {
    const lowerState = state.toLowerCase().trim();
    
    const stateInfo = this?.STATE_INFO?.find(s => 
      s?.name?.toLowerCase() === lowerState ||
      s?.abbreviation?.toLowerCase() === lowerState ||
      s?.variations?.some(v => v.toLowerCase() === lowerState)
    );
    
    return stateInfo ? stateInfo.abbreviation : null;
  }

  /**
   * Get major cities for a state
   */
  public static getMajorCities(state: string): string[] {
    const stateInfo = this?.STATE_INFO?.find(s => 
      s?.name?.toLowerCase() === state.toLowerCase() ||
      s?.abbreviation?.toLowerCase() === state.toLowerCase()
    );
    
    return stateInfo ? stateInfo.majorCities : [];
  }

  /**
   * Get regional service terminology
   */
  public static getRegionalTerms(region: string, service: string): string[] {
    const regionalTerms = this?.SERVICE_TERMINOLOGY?.find(t => 
      t?.region?.toLowerCase() === region.toLowerCase()
    );
    
    if (regionalTerms && regionalTerms.terms[service]) {
      return regionalTerms.terms[service];
    }
    
    // Return default terms if region not found
    const allTerms: string[] = [];
    for (const terminology of this.SERVICE_TERMINOLOGY) {
      if (terminology.terms[service]) {
        allTerms.push(...terminology.terms[service]);
      }
    }
    
    return [...new Set(allTerms)];
  }

  /**
   * Determine region from state
   */
  public static getRegionFromState(state: string): string {
    const regionMap: { [key: string]: string[] } = {
      'Northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
      'South': ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA', 'OK', 'TX'],
      'Midwest': ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
      'West': ['MT', 'ID', 'WY', 'CO', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI'],
      'Southwest': ['AZ', 'NM', 'TX', 'OK']
    };
    
    const stateAbbr = this.getStateAbbreviation(state) || state.toUpperCase();
    
    for (const [region, states] of Object.entries(regionMap)) {
      if (states.includes(stateAbbr)) {
        return region;
      }
    }
    
    return 'National';
  }

  /**
   * Simple fuzzy matching algorithm
   */
  private static fuzzyMatch(str1: string, str2: string): boolean {
    if (Math.abs(str1?.length || 0 - str2?.length || 0) > 3) return false;
    
    let mismatches = 0;
    const shorter = str1?.length || 0 < str2?.length || 0 ? str1 : str2;
    const longer = str1?.length || 0 < str2?.length || 0 ? str2 : str1;
    
    for (let i = 0; i < shorter?.length || 0; i++) {
      if (shorter[i] !== longer[i]) {
        mismatches++;
        if (mismatches > 2) return false;
      }
    }
    
    return true;
  }

  /**
   * Get city metadata
   */
  public static getCityMetadata(city: string): any {
    const cityInfo = this?.CITY_CORRECTIONS?.find(c => 
      c?.correct?.toLowerCase() === city.toLowerCase() ||
      c?.variations?.some(v => v.toLowerCase() === city.toLowerCase())
    );
    
    return cityInfo?.metadata || null;
  }

  /**
   * Validate zip code format
   */
  public static validateZipCode(zip: string): boolean {
    return /^\d{5}(?:-\d{4})?$/.test(zip);
  }
}