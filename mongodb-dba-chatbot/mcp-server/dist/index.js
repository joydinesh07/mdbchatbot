import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { MongoClient } from "mongodb";
// Configuration
// In a real app, this would come from process.env.MONGO_CLUSTERS (JSON)
const CLUSTERS = {
    "Production": "mongodb://localhost:27017/?replicaSet=rs0",
    "Analytics": "mongodb://localhost:27020"
};
const DB_NAME = process.env.DB_NAME || "test";
// MongoDB Clients Map
const clients = {};
async function connectDB() {
    for (const [name, uri] of Object.entries(CLUSTERS)) {
        try {
            console.error(`Connecting to ${name} at ${uri}...`);
            const client = new MongoClient(uri);
            await client.connect();
            clients[name] = client;
            console.error(`Connected to ${name}`);
        }
        catch (err) {
            console.error(`Failed to connect to ${name}`, err);
        }
    }
}
// --- Tools Definitions ---
const getDbStatsTool = {
    name: "get_db_stats",
    description: "Get general statistics about the database (db.stats() and serverStatus)",
    inputSchema: {
        type: "object",
        properties: {
            cluster_name: {
                type: "string",
                enum: Object.keys(CLUSTERS),
                description: "Target cluster (default: Production)"
            }
        }
    },
};
const getCurrentSlowOpsTool = {
    name: "get_current_slow_ops",
    description: "Get currently running slow operations (currentOp)",
    inputSchema: {
        type: "object",
        properties: {
            thresholdSeconds: {
                type: "number",
                description: "Threshold in seconds to consider an op slow (default: 3)",
            },
            cluster_name: {
                type: "string",
                enum: Object.keys(CLUSTERS),
                description: "Target cluster (default: Production)"
            }
        },
    },
};
const analyzeProfilerLogsTool = {
    name: "analyze_profiler_logs",
    description: "Analyze system.profile for problematic queries in the last 24 hours",
    inputSchema: {
        type: "object",
        properties: {
            limit: {
                type: "number",
                description: "Max number of queries to return (default: 10)",
            },
            cluster_name: {
                type: "string",
                enum: Object.keys(CLUSTERS),
                description: "Target cluster (default: Production)"
            }
        },
    },
};
const checkReplicationStatusTool = {
    name: "check_replication_status",
    description: "Check Replica Set status and check for replication lag",
    inputSchema: {
        type: "object",
        properties: {
            cluster_name: {
                type: "string",
                enum: Object.keys(CLUSTERS),
                description: "Target cluster (default: Production)"
            }
        }
    },
};
// --- Server Setup ---
const server = new Server({
    name: "mongodb-dba-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            getDbStatsTool,
            getCurrentSlowOpsTool,
            analyzeProfilerLogsTool,
            checkReplicationStatusTool,
        ],
    };
});
function getClient(request) {
    const args = request.params.arguments;
    const name = args?.cluster_name || "Production";
    const client = clients[name];
    if (!client) {
        throw new Error(`Cluster '${name}' not found or not connected. Available: ${Object.keys(clients).join(", ")}`);
    }
    return client;
}
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const client = getClient(request);
        const db = client.db(DB_NAME);
        const adminDb = client.db("admin");
        if (request.params.name === "get_db_stats") {
            const stats = await db.stats();
            const serverStatus = await adminDb.command({ serverStatus: 1 });
            const summary = {
                version: serverStatus.version,
                uptime: serverStatus.uptime,
                connections: serverStatus.connections,
                opcounters: serverStatus.opcounters,
                mem: serverStatus.mem,
                locks: serverStatus.locks?.Global
            };
            return {
                content: [{ type: "text", text: JSON.stringify({ dbStats: stats, serverStatus: summary }, null, 2) }],
            };
        }
        if (request.params.name === "get_current_slow_ops") {
            const args = request.params.arguments;
            const threshold = args?.thresholdSeconds || 3;
            const currentOp = await adminDb.command({ currentOp: 1, secs_running: { $gte: threshold } });
            return {
                content: [{ type: "text", text: JSON.stringify(currentOp, null, 2) }],
            };
        }
        if (request.params.name === "analyze_profiler_logs") {
            const args = request.params.arguments;
            const limit = args?.limit || 10;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const profile = db.collection("system.profile");
            const queries = await profile
                .find({ ts: { $gte: yesterday } })
                .sort({ millis: -1 })
                .limit(limit)
                .toArray();
            if (queries.length === 0) {
                return {
                    content: [{ type: "text", text: "No queries found in system.profile for the last 24h. Ensure profiling is enabled or traffic is low." }]
                };
            }
            return {
                content: [{ type: "text", text: JSON.stringify(queries, null, 2) }],
            };
        }
        if (request.params.name === "check_replication_status") {
            try {
                const rsStatus = await adminDb.command({ replSetGetStatus: 1 });
                const members = rsStatus.members || [];
                const primary = members.find((m) => m.stateStr === "PRIMARY");
                let lagInfo = "No Primary found to calculate lag.";
                if (primary && primary.optimeDate) {
                    const primaryTime = new Date(primary.optimeDate).getTime();
                    if (!isNaN(primaryTime)) {
                        lagInfo = members.map((m) => {
                            if (m.stateStr === "PRIMARY")
                                return `${m.name}: PRIMARY`;
                            if (!m.optimeDate)
                                return `${m.name}: No optimeDate`;
                            const mTime = new Date(m.optimeDate).getTime();
                            const lag = (primaryTime - mTime) / 1000;
                            return `${m.name} (${m.stateStr}): Lag ${lag}s`;
                        }).join("\n");
                    }
                }
                return {
                    content: [{ type: "text", text: JSON.stringify(rsStatus, null, 2) + "\n\nLag Analysis:\n" + lagInfo }],
                };
            }
            catch (err) {
                if (err.codeName === "NoReplicationEnabled") {
                    return { content: [{ type: "text", text: "Replication is not enabled on this server." }] };
                }
                throw err;
            }
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [{ type: "text", text: `Error executing tool ${request.params.name}: ${error.message}` }],
        };
    }
    throw new Error("Tool not found");
});
async function main() {
    await connectDB();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MongoDB MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
