module.exports = function(RED) {
    function AccumulateBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "accumulate";
        
        // Initialize state
        let count = 0;
        let lastCount = null;

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (msg.context) {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }
                if (msg.context === "reset") {
                    if (typeof msg.payload !== "boolean") {
                        node.status({ fill: "red", shape: "ring", text: "invalid reset" });
                        if (done) done();
                        return;
                    }
                    if (msg.payload === true) {
                        count = 0;
                        lastCount = null;
                        node.status({ fill: "green", shape: "dot", text: "state reset" });
                    }
                    if (done) done();
                    return;
                } else {
                    node.status({ fill: "red", shape: "ring", text: "unknown context" });
                    if (done) done();
                    return;
                }
            }

            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing input" });
                if (done) done();
                return;
            }

            const inputValue = msg.payload;
            if (typeof inputValue !== "boolean") {
                node.status({ fill: "red", shape: "ring", text: "invalid input" });
                if (done) done();
                return;
            }

            // Accumulate or reset count
            if (inputValue === true) {
                count++;
            } else {
                count = 0;
            }

            // Output only if count changed
            if (lastCount !== count) {
                lastCount = count;
                node.status({ fill: "blue", shape: "dot", text: `out: ${count}` });
                send({ payload: count });
            } else {
                node.status({ fill: "blue", shape: "ring", text: `out: ${count}` });
            }

            if (done) done();
            return;
        });

        node.on("close", function(done) {
            // Reset state on redeployment
            count = 0;
            lastCount = null;
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("accumulate-block", AccumulateBlockNode);

    // Serve dynamic config from runtime
    RED.httpAdmin.get("/accumulate-block/:id", RED.auth.needsPermission("accumulate-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "accumulate-block") {
            res.json({ name: node.name || "accumulate" });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};