const fs = require("fs").promises;
const path = require("path");

module.exports = function(RED) {
    function MemoryBlockNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const utils = require("./utils");

        // Initialize runtime state
        node.runtime = {
            name: config.name || "",
            writePeriod: config.writePeriod || "60000",
            writePeriodType: config.writePeriodType || "num",
            storedMsg: null
        };

        // File path for persistent storage
        const filePath = path.join(RED.settings.userDir, `memory-${node.id}.json`);

        // In-memory cache
        let writeTimeout = null;
        let lastUpdateMsg = null;

        // Load stored message from file
        async function loadStoredMessage() {
            try {
                const data = await fs.readFile(filePath, "utf8");
                node.runtime.storedMsg = JSON.parse(data);
                const payloadStr = node.runtime.storedMsg.payload != null ? String(node.runtime.storedMsg.payload).substring(0, 20) : "null";
                node.status({ fill: "green", shape: "dot", text: `loaded: ${payloadStr}` });
            } catch (err) {
                if (err.code !== "ENOENT") {
                    node.status({ fill: "red", shape: "ring", text: "file error" });
                }
            }
        }

        // Save message to file
        async function saveMessage() {
            if (lastUpdateMsg === null) return;
            try {
                await fs.writeFile(filePath, JSON.stringify(lastUpdateMsg));
                lastUpdateMsg = null;
            } catch (err) {
                node.status({ fill: "red", shape: "ring", text: "file error" });
            }
        }

        // Initialize
        loadStoredMessage().catch(err => {
            node.error("Failed to load stored message: " + err.message);
        });

        node.on("input", function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };

            // Guard against invalid message
            if (!msg) {
                node.status({ fill: "red", shape: "ring", text: "invalid message" });
                if (done) done();
                return;
            }

            // Resolve writePeriod
            const writePeriod = utils.getTypedValue(node, msg, node.runtime.writePeriod, node.runtime.writePeriodType, { min: 0, name: "write period" }, 60000);
            if (isNaN(writePeriod) || !isFinite(writePeriod)) {
                node.status({ fill: "red", shape: "ring", text: "invalid write period" });
                node.runtime.writePeriod = "60000";
            } else {
                node.runtime.writePeriod = writePeriod.toString();
            }
            node.runtime.writePeriodType = "num";

            // Initialize output array: [Output 1, Output 2]
            const output = [null, null];

            // Handle context
            if (!msg.hasOwnProperty("context") || !msg.context || typeof msg.context !== "string") {
                // Pass-through message to Output 2
                const payloadStr = msg.payload != null ? String(msg.payload).substring(0, 20) : "null";
                node.status({ fill: "blue", shape: "dot", text: `in: ${payloadStr}, out2: ${payloadStr}` });
                output[1] = msg;
                send(output);
                if (done) done();
                return;
            }

            if (msg.context === "update") {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }
                node.runtime.storedMsg = RED.util.cloneMessage(msg);
                lastUpdateMsg = node.runtime.storedMsg;
                const payloadStr = msg.payload != null ? String(msg.payload).substring(0, 20) : "null";
                node.status({ fill: "green", shape: "dot", text: `updated: ${payloadStr}` });
                if (writeTimeout) clearTimeout(writeTimeout);
                writeTimeout = setTimeout(() => {
                    saveMessage().catch(err => {
                        node.error("Failed to save message: " + err.message);
                    });
                }, writePeriod);
                if (done) done();
                return;
            }

            if (msg.context === "execute") {
                if (node.runtime.storedMsg !== null) {
                    const payloadStr = node.runtime.storedMsg.payload != null ? String(node.runtime.storedMsg.payload).substring(0, 20) : "null";
                    node.status({ fill: "blue", shape: "dot", text: `in: execute, out2: ${payloadStr}` });
                    output[1] = node.runtime.storedMsg;
                } else {
                    node.status({ fill: "blue", shape: "dot", text: `in: execute, out2: null` });
                    output[1] = { payload: null }; // Option 2: Output null to Output 2
                }
                send(output);
                if (done) done();
                return;
            }

            if (msg.context === "query") {
                const hasValue = node.runtime.storedMsg !== null;
                node.status({ fill: "blue", shape: "dot", text: `in: query, out1: ${hasValue}` });
                output[0] = { payload: hasValue }; // Option 3: Output true/false to Output 1
                send(output);
                if (done) done();
                return;
            }

            node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
            if (done) done("Unknown context");
        });

        node.on("close", function(done) {
            if (writeTimeout) clearTimeout(writeTimeout);
            saveMessage()
                .then(() => {
                    node.status({});
                    done();
                })
                .catch(err => {
                    node.error("Failed to save message on close: " + err.message);
                    node.status({});
                    done();
                });
        });
    }

    RED.nodes.registerType("memory-block", MemoryBlockNode);

    // Serve runtime state for editor
    RED.httpAdmin.get("/memory-block-runtime/:id", RED.auth.needsPermission("memory-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "memory-block") {
            res.json({
                name: node.runtime.name,
                writePeriod: node.runtime.writePeriod,
                writePeriodType: node.runtime.writePeriodType,
                storedMsg: node.runtime.storedMsg
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};