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
  console.log('    Raw LLM response:', content.substring(0, 500));
  return JSON.parse(content);
}

async function populateHTSCodes() {
  console.log('Generating HTS codes with AI...');
  
  const categories = [
    'Textiles and Apparel',
    'Electronics and Machinery',
    'Food and Beverages',
    'Chemicals and Pharmaceuticals',
    'Automotive and Transportation',
    'Furniture and Home Goods',
    'Agricultural Products',
    'Metals and Minerals',
    'Plastics and Rubber',
    'Wood and Paper Products'
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
        content: `Generate 20 realistic HTS codes for the category "${category}". Each item must have: code (10-digit string), description (detailed product description), category (string), unit (e.g., "kg", "dozen", "number", "liters"). Return as JSON with "items" array.`
      }
    ]);

    console.log(`    AI returned ${result.items.length} items`);
    console.log(`    Sample item:`, JSON.stringify(result.items[0], null, 2));
    
    const codes = result.items.map(item => ({
      code: String(item.code || item.htsCode || '0000.00.0000'),
      description: String(item.description || ''),
      category: category,
      unit: String(item.unit || 'kg'),
    }));

    console.log(`    Sample mapped code:`, JSON.stringify(codes[0], null, 2));
    await db.insert(htsCodes).values(codes);
    console.log(`    Inserted ${codes.length} codes`);
  }
}

async function populateTariffRates() {
  console.log('Generating tariff rates with AI...');
  
  const allCodes = await db.select().from(htsCodes);
  console.log(`  Found ${allCodes.length} HTS codes`);

  const countries = ['USA', 'CHN', 'GBR', 'DEU', 'JPN', 'CAN', 'MEX', 'FRA', 'IND', 'BRA'];
  const tradePairs = [];
  
  for (const origin of countries) {
    for (const dest of countries) {
      if (origin !== dest) {
        tradePairs.push({ origin, dest });
      }
    }
  }

  console.log(`  Generating rates for ${tradePairs.length} country pairs...`);

  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < allCodes.length; i += batchSize) {
    const batch = allCodes.slice(i, i + batchSize);
    
    for (const pair of tradePairs) {
      const result = await invokeLLM([
        {
          role: 'system',
          content: 'You are a trade compliance expert. Generate realistic tariff rates based on product categories and trade relationships.'
        },
        {
          role: 'user',
          content: `Generate tariff rates for these HTS codes from ${pair.origin} to ${pair.dest}:
${batch.map(c => `${c.code}: ${c.description}`).join('\n')}

For each code, provide: htsCode (string), rate (number 0-50, realistic tariff percentage), originCountry (3-letter code), destinationCountry (3-letter code), tradeAgreement (string or null, e.g., "USMCA", "EU-UK TCA"), effectiveDate (ISO date string, recent date). Return as JSON with "items" array.`
        }
      ]);

      const rates = result.items.map(item => ({
        htsCode: item.htsCode,
        rate: item.rate,
        originCountry: item.originCountry,
        destinationCountry: item.destinationCountry,
        tradeAgreement: item.tradeAgreement,
        effectiveDate: new Date(item.effectiveDate),
      }));

      await db.insert(tariffRates).values(rates);
    }
    
    console.log(`    Processed ${Math.min(i + batchSize, allCodes.length)}/${allCodes.length} codes`);
  }
}

async function populateRegulations() {
  console.log('Generating trade regulations with AI...');
  
  const countries = ['USA', 'CHN', 'GBR', 'DEU', 'JPN', 'CAN', 'MEX', 'FRA', 'IND', 'BRA', 'AUS', 'KOR', 'ITA', 'ESP', 'NLD'];
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
        content: `Generate 10 realistic trade regulations for ${country}. Each must have: title (regulation name), description (detailed explanation), requirements (specific requirements), regulationType (one of: ${regulationTypes.join(', ')}), countryCode (3-letter), effectiveDate (ISO date string), documentationNeeded (string or null), sourceUrl (realistic government URL or null). Return as JSON with "items" array.`
      }
    ]);

    const regulations = result.items.map(item => ({
      title: item.title,
      description: item.description,
      requirements: item.requirements,
      regulationType: item.regulationType,
      countryCode: country,
      effectiveDate: new Date(item.effectiveDate),
      documentationNeeded: item.documentationNeeded,
      sourceUrl: item.sourceUrl,
    }));

    await db.insert(tradeRegulations).values(regulations);
    console.log(`    Inserted ${regulations.length} regulations`);
  }
}

async function main() {
  console.log('Starting AI-powered data population...\n');
  
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
