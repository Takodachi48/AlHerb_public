export const PHILIPPINE_LOCATIONS = {
  cities: [
    'Manila', 'Quezon City', 'Caloocan', 'Davao City', 'Cebu City', 'Zamboanga City',
    'Angeles City', 'Baguio City', 'Bacolod', 'Iloilo City', 'Lapu-Lapu City',
    'Puerto Princesa', 'Tacloban', 'General Santos', 'Lipa City', 'Tagaytay City',
    'San Pablo City', 'San Pedro City', 'Makati City', 'Mandaluyong City', 'Pasay City',
    'Cavite City', 'Batangas City', 'Lucena City', 'Taytay City', 'Biñan City', 'San Jose City',
    'San Fernando City', 'Malolos City', 'Cabuyao City', 'San Mateo City', 'San Carlos City',
    'Ligao City', 'Iriga City', 'Muñoz City', 'San Miguel City', 'Tuguegarao City', 'Gapan City',
    'Meycauayan City', 'Balanga City', 'Baliuag City', 'San Jose del Monte City', 'Calapan City',
    'Antipolo City', 'Cainta City', 'Tanza City', 'Navotas City', 'Malabon City', 'Muntinlupa City',
    'Las Piñas City', 'Parañaque City', 'Valenzuela City', 'Marikina City', 'San Juan City', 'Pasig City',
    'Mandaluyong City', 'Caloocan City', 'Taguig City', 'Pateros City', 'Cainta City', 'Taytay City'
  ],
  
  provinces: [
    'Metro Manila', 'Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon', 'Bulacan', 'Pampanga',
    'Tarlac', 'Zambales', 'Bataan', 'Aurora', 'Nueva Ecija', 'Nueva Vizcaya', 'Pangasinan',
    'Tarlac', 'Zambales', 'Ilocos Region', 'Cagayan Valley', 'Cordillera Administrative Region', 'Mimaropa',
    'Bicol Region', 'Western Visayas', 'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula',
    'Northern Mindanao', 'Davao Region', 'Soccsksargen', 'Caraga', 'Bangsamoro Autonomous Region',
    'Autonomous Region of Muslim Mindanao'
  ],
  
  regions: [
    'National Capital Region (NCR)', 'Cordillera Administrative Region (CAR)', 'Ilocos Region (Region I)',
    'Cagayan Valley (Region II)', 'Central Luzon (Region III)', 'Calabarzon (Region IV-A)',
    'Mimaropa (Region IV-B)', 'Bicol Region (Region V)', 'Western Visayas (Region VI)',
    'Central Visayas (Region VII)', 'Eastern Visayas (Region VIII)', 'Zamboanga Peninsula (Region IX)',
    'Northern Mindanao (Region X)', 'Davao Region (Region XI)', 'Soccsksargen (Region XII)',
    'Caraga (Region XIII)', 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'
  ],

  // Region to provinces mapping
  regionToProvinces: {
    'National Capital Region (NCR)': ['Metro Manila'],
    'Cordillera Administrative Region (CAR)': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province', 'Ilocos Sur'],
    'Ilocos Region (Region I)': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
    'Cagayan Valley (Region II)': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
    'Central Luzon (Region III)': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
    'Calabarzon (Region IV-A)': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
    'Mimaropa (Region IV-B)': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
    'Bicol Region (Region V)': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
    'Western Visayas (Region VI)': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
    'Central Visayas (Region VII)': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
    'Eastern Visayas (Region VIII)': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
    'Zamboanga Peninsula (Region IX)': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
    'Northern Mindanao (Region X)': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
    'Davao Region (Region XI)': ['Compostela Valley', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
    'Soccsksargen (Region XII)': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
    'Caraga (Region XIII)': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
    'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)': ['Basilan', 'Lanao del Sur', 'Maguindanao', 'Sulu', 'Tawi-Tawi']
  },

  // Province to cities mapping (simplified for demo)
  provinceToCities: {
    'Metro Manila': ['Manila', 'Quezon City', 'Caloocan', 'Makati City', 'Mandaluyong City', 'Pasay City', 'San Juan City', 'Pasig City', 'Taguig City', 'Navotas City', 'Malabon City', 'Muntinlupa City', 'Las Piñas City', 'Parañaque City', 'Marikina City', 'Valenzuela City', 'San Jose del Monte City'],
    'Cavite': ['Cavite City', 'Tagaytay City', 'Bacoor City', 'Imus City', 'Dasmariñas City', 'General Trias City', 'Silang City', 'Tanza City', 'Trece Martires City', 'Carmona City'],
    'Laguna': ['Calamba City', 'San Pablo City', 'Santa Rosa City', 'Biñan City', 'Cabuyao City', 'San Pedro City', 'Calauan City', 'Bay City', 'Los Baños City'],
    'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City', 'Lemery City', 'Balayan City', 'Santo Tomas City', 'Rosario City', 'Taal City', 'San Juan City', 'Cuenca City'],
    'Rizal': ['Antipolo City', 'Taytay City', 'Cainta City', 'San Mateo City', 'Rodriguez City', 'Angono City', 'Teresa City', 'Morong City', 'Cardona City', 'Binangonan City'],
    'Bulacan': ['Malolos City', 'Meycauayan City', 'San Jose del Monte City', 'Santa Maria City', 'Baliuag City', 'Meycauayan City', 'Pulilan City', 'Calumpit City'],
    'Pampanga': ['Angeles City', 'San Fernando City', 'Mabalacat City', 'Lubao City', 'Guagua City', 'Mexico City', 'Arayat City', 'Magalang City', 'Minalin City'],
    'Iloilo': ['Iloilo City', 'Passi City', 'Roxas City', 'Pototan City', 'Dumangas City', 'Jordan City', 'San Miguel City', 'Cabatuan City'],
    'Cebu': ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Mandaue City', 'Talisay City', 'Naga City', 'Bogo City', 'Carcar City', 'Danao City'],
    'Davao del Sur': ['Davao City', 'Digos City', 'Tagum City', 'Mati City', 'Panabo City', 'Island Garden City of Samal'],
    'Negros Occidental': ['Bacolod City', 'Silay City', 'Kabankalan City', 'San Carlos City', 'Victorias City', 'Sagay City', 'Escalante City', 'San Carlos City'],
    'Negros Oriental': ['Dumaguete City', 'Bayawan City', 'Bais City', 'Canlaon City', 'Guihulngan City', 'Jimalalud de Padua', 'Mabinay', 'Manjuyod', 'Siaton', 'Sibulan', 'Tanjay City', 'Tayasan', 'Valencia'],
    'Cagayan': ['Tuguegarao City', 'Solana City', 'Lallo City', 'Gapan City', 'Sanchez Mira City', 'Aparri City', 'Tuao', 'Piat', 'Rizal', 'Alcala', 'Baggao', 'Amulung'],
    'Isabela': ['Cauayan City', 'Ilagan City', 'Santiago City', 'Cauayan City', 'Roxas City', 'Alicia City', 'Cabagan City', 'Mallig City', 'San Mateo City', 'San Pablo City'],
    'Pangasinan': ['Dagupan City', 'Urdaneta City', 'San Carlos City', 'Alaminos City', 'Lingayen City', 'Mangaldan City', 'Umingan', 'Binmaley', 'Bolinao', 'Agno', 'Mabini'],
    'Ilocos Sur': ['Vigan City', 'Candon City', 'San Fernando City', 'Laoag City', 'Batac City', 'San Juan City', 'Cabugao City', 'Santiago City']
  }
};
