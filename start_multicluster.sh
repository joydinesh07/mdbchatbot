#!/bin/bash

# Start Replica Set 0 (rs0) - Production
echo "Starting rs0 Node 1 (27017)..."
mongod --logpath data/rs0-0/mongod.log --dbpath data/rs0-0 --port 27017 --replSet rs0 --bind_ip localhost >> data/rs0-0/stdout.log 2>&1 &
echo "Starting rs0 Node 2 (27018)..."
mongod --logpath data/rs0-1/mongod.log --dbpath data/rs0-1 --port 27018 --replSet rs0 --bind_ip localhost >> data/rs0-1/stdout.log 2>&1 &
echo "Starting rs0 Node 3 (27019)..."
mongod --logpath data/rs0-2/mongod.log --dbpath data/rs0-2 --port 27019 --replSet rs0 --bind_ip localhost >> data/rs0-2/stdout.log 2>&1 &

# Start Standalone - Analytics
echo "Starting Analytics Node (27020)..."
mongod --logpath data/analytics/mongod.log --dbpath data/analytics --port 27020 --bind_ip localhost >> data/analytics/stdout.log 2>&1 &

echo "Waiting 10s for instances to boot..."
sleep 10

# Initiate Replica Set
echo "Initiating Replica Set rs0..."
mongosh --port 27017 --eval 'try { rs.initiate({_id: "rs0", members: [{_id: 0, host: "localhost:27017"}, {_id: 1, host: "localhost:27018"}, {_id: 2, host: "localhost:27019"}]}) } catch (e) { print(e); if (e.codeName === "AlreadyInitialized") print("Already initialized"); else throw e; }'

echo "Done! Cluster Status:"
mongosh --port 27017 --eval "rs.status()"
