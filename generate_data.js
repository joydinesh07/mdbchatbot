const { MongoClient } = require('mongodb');

// Clusters
const PROD_URI = 'mongodb://localhost:27017/?replicaSet=rs0';
const ANALYTICS_URI = 'mongodb://localhost:27020';

async function generateData(uri, dbName, count, label) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        console.log(`Connected to ${label} (${uri})...`);

        // Users
        const users = [];
        for (let i = 0; i < count; i++) {
            users.push({
                name: `User ${i}`,
                email: `user${i}@example.com`,
                signupDate: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
                active: Math.random() > 0.2
            });
        }
        await db.collection('users').insertMany(users);
        console.log(`Inserted ${count} users into ${label}`);

        // Orders (only for production)
        if (label === 'Production') {
            const orders = [];
            for (let i = 0; i < count * 2; i++) {
                orders.push({
                    userId: Math.floor(Math.random() * count),
                    amount: parseFloat((Math.random() * 100).toFixed(2)),
                    status: ['pending', 'completed', 'shipped'][Math.floor(Math.random() * 3)],
                    date: new Date()
                });
            }
            await db.collection('orders').insertMany(orders);
            console.log(`Inserted ${count * 2} orders into ${label}`);
        }

        // Logs (only for analytics)
        if (label === 'Analytics') {
            const logs = [];
            for (let i = 0; i < count * 5; i++) {
                logs.push({
                    service: 'api-gateway',
                    level: ['INFO', 'WARN', 'ERROR'][Math.floor(Math.random() * 3)],
                    message: `Log entry ${i}`,
                    timestamp: new Date()
                });
            }
            await db.collection('app_logs').insertMany(logs);
            console.log(`Inserted ${count * 5} logs into ${label}`);
        }

    } catch (e) {
        console.error(`Error connecting to ${label}: `, e);
    } finally {
        await client.close();
    }
}

async function main() {
    // Install connection deps if needed (assuming mcp-server has mongodb installed, we can reuse or install in temp)
    // Actually we can run this with 'node generate_data.js' if 'mongodb' is in node_modules of mcp-server
    
    await generateData(PROD_URI, 'prod_db', 1000, 'Production');
    await generateData(ANALYTICS_URI, 'analytics_db', 500, 'Analytics');
    console.log("Data generation complete.");
}

main();
