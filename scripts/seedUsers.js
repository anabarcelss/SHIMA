// scripts/seedUsers.js
// Generates and seeds mockup users via POST http://localhost:3000/register

const TARGET_URL = process.env.API_URL || "http://localhost:3000/register";
const TOTAL_USERS = parseInt(process.env.COUNT || "750", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "15", 10);

const FIRST_NAMES = [
  "Lucas", "Gabriel", "Mateus", "Felipe", "Guilherme", "Rafael", "Rodrigo", "Bruno",
  "Eduardo", "Thiago", "Leonardo", "Vinicius", "Gustavo", "Diego", "Marcelo", "Alexandre",
  "Caio", "Renan", "Danilo", "Igor", "Mariana", "Beatriz", "Larissa", "Camila",
  "Juliana", "Fernanda", "Amanda", "Leticia", "Bruna", "Jessica", "Carolina", "Patricia",
  "Aline", "Vanessa", "Barbara", "Renata", "Daniela", "Thais", "Natalia", "Isabela",
  "João", "Pedro", "Henrique", "Arthur", "Bernardo", "Heitor", "Davi", "Lorenzo",
  "Alice", "Sophia", "Helena", "Valentina", "Laura", "Isabella", "Manuela", "Júlia",
  "Maria", "Carlos", "Paulo", "Luiz", "Marcos", "Fabio", "Luciana", "Tatiane"
];

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira",
  "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes",
  "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade",
  "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas", "Cardoso", "Ramos",
  "Gonçalves", "Santana", "Teixeira", "Pinto", "Castro", "Cavalcanti", "Monteiro", "Moura"
];

const DDD_LIST = ["11", "19", "21", "27", "31", "41", "47", "51", "61", "71", "81", "85", "91"];

const STREET_TYPES = ["Rua", "Avenida", "Travessa", "Alameda", "Praça"];
const STREET_NAMES = [
  "das Flores", "Paulista", "Brasil", "Sete de Setembro", "XV de Novembro", "São Paulo",
  "Copacabana", "Independência", "Santos Dumont", "Tiradentes", "Amazonas", "Belo Horizonte",
  "do Sol", "da Feira", "dos Pinheiros", "Getúlio Vargas", "Juscelino Kubitschek", "Rui Barbosa",
  "Duque de Caxias", "Barão do Rio Branco", "das Palmeiras", "Bela Cintra", "Oscar Freire"
];
const NEIGHBORHOODS = [
  "Centro", "Jardins", "Bela Vista", "Copacabana", "Savassi", "Boa Viagem",
  "Meireles", "Moema", "Pinheiros", "Vila Mariana", "Botafogo", "Ipanema", "Barra da Tijuca"
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomName() {
  const firstName = getRandomElement(FIRST_NAMES);
  const lastName1 = getRandomElement(LAST_NAMES);
  // 40% chance of double surname
  if (Math.random() < 0.4) {
    let lastName2 = getRandomElement(LAST_NAMES);
    while (lastName2 === lastName1) {
      lastName2 = getRandomElement(LAST_NAMES);
    }
    return `${firstName} ${lastName1} ${lastName2}`.slice(0, 50);
  }
  return `${firstName} ${lastName1}`.slice(0, 50);
}

function generateRandomPhoneNumber() {
  const ddd = getRandomElement(DDD_LIST);
  const prefix = "9";
  const rest = String(getRandomInt(10000000, 99999999));
  // 11 digits: e.g. 11987654321, fits in varchar(12)
  return `${ddd}${prefix}${rest}`;
}

function generateRandomAddress() {
  const type = getRandomElement(STREET_TYPES);
  const street = getRandomElement(STREET_NAMES);
  const num = getRandomInt(10, 2500);
  const neighborhood = getRandomElement(NEIGHBORHOODS);
  
  if (Math.random() < 0.3) {
    const apt = getRandomInt(11, 1404);
    return `${type} ${street}, ${num}, Apto ${apt} - ${neighborhood}`.slice(0, 255);
  }
  return `${type} ${street}, ${num} - ${neighborhood}`.slice(0, 255);
}

function generateMockUser(hasAllFields) {
  const name = generateRandomName();
  if (hasAllFields) {
    return {
      name,
      age: getRandomInt(18, 78),
      number: generateRandomPhoneNumber(),
      address: generateRandomAddress(),
    };
  }
  // User with just the name
  return {
    name,
    
  };
}

async function sendUser(userData) {
  const res = await fetch(TARGET_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

async function main() {
  console.log(`Starting mock data generation:`);
  console.log(`- Target: ${TARGET_URL}`);
  console.log(`- Total users to create: ${TOTAL_USERS}`);
  console.log(`- Concurrency: ${CONCURRENCY}\n`);

  // Verify server is reachable
  try {
    const healthCheck = await fetch(new URL("/", TARGET_URL).toString());
    if (!healthCheck.ok) {
      console.warn(`Warning: Root check returned HTTP ${healthCheck.status}`);
    }
  } catch (err) {
    console.error(`Error: Cannot reach server at ${TARGET_URL}. Is the server running?`);
    console.error(err.message);
    process.exit(1);
  }

  // Pre-generate list of users
  // Roughly 50% all fields, 50% just name
  const users = [];
  let allFieldsCount = 0;
  let justNameCount = 0;

  for (let i = 0; i < TOTAL_USERS; i++) {
    // Alternating with slight randomness to achieve roughly 50-50
    const hasAllFields = Math.random() < 0.5;
    const user = generateMockUser(hasAllFields);
    users.push(user);
    if (hasAllFields) allFieldsCount++;
    else justNameCount++;
  }

  console.log(`Prepared mock users:`);
  console.log(`  Users with all fields: ${allFieldsCount} (${Math.round((allFieldsCount / TOTAL_USERS) * 100)}%)`);
  console.log(`  Users with just name:   ${justNameCount} (${Math.round((justNameCount / TOTAL_USERS) * 100)}%)\n`);

  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();

  // Run in chunks with controlled concurrency
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const chunk = users.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (user) => {
        try {
          await sendUser(user);
          succeeded++;
        } catch (err) {
          failed++;
          console.error(`\nFailed to register user "${user.name}": ${err.message}`);
        } finally {
          completed++;
          process.stdout.write(
            `\rProgress: ${completed}/${TOTAL_USERS} (${Math.round((completed / TOTAL_USERS) * 100)}%) | Success: ${succeeded} | Failed: ${failed}`
          );
        }
      })
    );
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\nFinished in ${durationSec}s!`);
  console.log(`Summary:`);
  console.log(`  Total created: ${succeeded}`);
  console.log(`  Failures: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
