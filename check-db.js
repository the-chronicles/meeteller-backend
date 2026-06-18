const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://meeteller_user:password@localhost:5432/meeteller'
  });
  await client.connect();
  
  console.log('--- DB USERS ---');
  const usersRes = await client.query('SELECT id, email, name FROM "user"');
  console.log(usersRes.rows);

  console.log('--- DB INTEGRATIONS ---');
  const integrationsRes = await client.query('SELECT * FROM "integration"');
  console.log(integrationsRes.rows);
  
  await client.end();
}

main().catch(console.error);
