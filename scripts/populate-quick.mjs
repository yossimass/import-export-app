import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { htsCodes, tariffRates, tradeRegulations } from '../drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

async function invokeLLM(messages) {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL 
    ? `${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, '')}/v1/chat/completions`
    : 'https://forge.manus.im/v1/chat/completions';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      response_format: {
        type: 'json_object',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${error}`);
  }
  const data = await response.json();
  const content = data.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse JSON:', content.substring(0, 500));
    throw e;
  }
}

async function populateHTSCodes() {
  console.log('Generating HTS codes with AI...');
  
  const categories = [
    'Textiles and Apparel',
    'Electronics and Machinery',
    'Food and Beverages',
    'Chemicals and Pharmaceuticals',
    'Automotive and Transportation',
  ];

  for (const category of categories) {
    console.log(`  Generating ${category}...`);
    
    const result = await invokeLLM([
      {
        role: 'system',
        content: 'You are a trade compliance expert. Generate realistic HTS (Harmonized Tariff Schedule) codes with 10-digit format (e.g., 6109.10.0010).'
      },
      {
        role: 'user',
        content: `Generate 20 realistic HTS codes for the category "${category}". Each item must have: code (10-digit string), description (brief product description under 100 chars), unit (e.g., "kg", "dozen", "number", "liters"). Return as JSON with "items" array.`
      }
    ]);
    
    const codes = result.items.map(item => ({
      code: String(item.code),
      description: String(item.description),
      category: category,
      unit: String(item.unit),
    }));

    await db.insert(htsCodes).values(codes);
    console.log(`    Inserted ${codes.length} codes`);
  }
}

async function populateTariffRates() {
  console.log('Generating tariff rates with AI...');
  
  const allCodes = await db.select().from(htsCodes);
  console.log(`  Found ${allCodes.length} HTS codes`);

  // Generate rates for common trade routes only
  const tradePairs = [
    { origin: 'CHN', dest: 'USA' },
    { origin: 'USA', dest: 'CHN' },
    { origin: 'MEX', dest: 'USA' },
    { origin: 'USA', dest: 'MEX' },
    { origin: 'CAN', dest: 'USA' },
    { origin: 'USA', dest: 'CAN' },
    { origin: 'GBR', dest: 'USA' },
    { origin: 'DEU', dest: 'USA' },
    { origin: 'JPN', dest: 'USA' },
    { origin: 'IND', dest: 'USA' },
  ];

  console.log(`  Generating rates for ${tradePairs.length} country pairs...`);

  for (const pair of tradePairs) {
    console.log(`    Generating ${pair.origin} → ${pair.dest}...`);
    
    const result = await invokeLLM([
      {
        role: 'system',
        content: 'You are a trade compliance expert. Generate realistic tariff rates based on product categories and trade relationships.'
      },
      {
        role: 'user',
        content: `Generate tariff rates for ALL these ${allCodes.length} HTS codes from ${pair.origin} to ${pair.dest}:
${allCodes.map(c => `${c.code}: ${c.description.substring(0, 80)}`).join('\n')}

For each code, provide: htsCode (exact code from list), rate (number 0-50, realistic tariff percentage), tradeAgreement (string or null, e.g., "USMCA", "EU-UK TCA"). Return as JSON with "items" array containing ALL ${allCodes.length} codes.`
      }
    ]);

    const rates = result.items.map(item => ({
      htsCode: String(item.htsCode),
      rate: Number(item.rate),
      originCountry: pair.origin,
      destinationCountry: pair.dest,
      tradeAgreement: item.tradeAgreement || null,
      effectiveDate: new Date('2024-01-01'),
    }));

    await db.insert(tariffRates).values(rates);
    console.log(`      Inserted ${rates.length} rates`);
  }
}

async function populateRegulations() {
  console.log('Generating trade regulations with AI...');
  
  const countries = ['USA', 'CHN', 'GBR', 'DEU', 'JPN', 'CAN', 'MEX', 'FRA', 'IND', 'BRA'];
  const regulationTypes = ['import_restriction', 'export_control', 'licensing_requirement', 'documentation_requirement', 'prohibited_goods'];

  for (const country of countries) {
    console.log(`  Generating regulations for ${country}...`);
    
    const result = await invokeLLM([
      {
        role: 'system',
        content: 'You are a trade compliance expert. Generate realistic trade regulations for different countries.'
      },
      {
        role: 'user',
        content: `Generate 15 realistic trade regulations for ${country}. Each must have: title (regulation name), description (detailed explanation), requirements (specific requirements), regulationType (one of: ${regulationTypes.join(', ')}), effectiveDate (ISO date string like "2024-01-01"), documentationNeeded (string or null), sourceUrl (realistic government URL or null). Return as JSON with "items" array.`
      }
    ]);

    const regulations = result.items.map(item => ({
      title: String(item.title),
      description: String(item.description),
      requirements: String(item.requirements),
      regulationType: String(item.regulationType),
      countryCode: country,
      effectiveDate: new Date(item.effectiveDate),
      documentationNeeded: item.documentationNeeded || null,
      sourceUrl: item.sourceUrl || null,
    }));

    await db.insert(tradeRegulations).values(regulations);
    console.log(`    Inserted ${regulations.length} regulations`);
  }
}

async function main() {
  console.log('Starting optimized AI-powered data population...\n');
  
  try {
    await populateHTSCodes();
    console.log('✓ HTS codes populated\n');
    
    await populateTariffRates();
    console.log('✓ Tariff rates populated\n');
    
    await populateRegulations();
    console.log('✓ Trade regulations populated\n');
    
    console.log('Database population complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
}

main();
