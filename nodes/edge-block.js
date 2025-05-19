module.exports = function(RED) {
    function EdgeBlockNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Initialize runtime state
        node.runtime = {
            name: config.name || "",
            algorithm: config.algorithm || "true-to-false",
            lastValue: null
        };

        // Validate initial config
        const validAlgorithms = ["true-to-false", "false-to-true"];
        if (!validAlgorithms.includes(node.runtime.algorithm)) {
            node.runtime.algorithm = "true-to-false";
            node.status({ fill: "red", shape: "ring", text: "invalid algorithm, using true-to-false" });
        } else {
            node.status({
                fill: "green",
                shape: "dot",
                text: `name: ${node.runtime.name || "edge"}, algorithm: ${node.runtime.algorithm}`
            });
        }

        node.on("input", function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };

            // Guard against invalid message
            if (!msg) {
                node.status({ fill: "red", shape: "ring", text: "invalid message" });
                if (done) done();
                return;
            }

            // Handle configuration messages
            if (msg.hasOwnProperty("context") && typeof msg.context === "string") {
                if (msg.context === "algorithm") {
                    if (!msg.hasOwnProperty("payload")) {
                        node.status({ fill: "red", shape: "ring", text: "missing payload" });
                        if (done) done();
                        return;
                    }
                    const newAlgorithm = String(msg.payload);
                    if (!validAlgorithms.includes(newAlgorithm)) {
                        node.status({ fill: "red", shape: "ring", text: "invalid algorithm" });
                        if (done) done();
                        return;
                    }
                    node.runtime.algorithm = newAlgorithm;
                    node.status({ fill: "green", shape: "dot", text: `algorithm: ${newAlgorithm}` });
                    if (done) done();
                    return;
                }

                if (msg.context === "reset") {
                    if (!msg.hasOwnProperty("payload") || typeof msg.payload !== "boolean") {
                        node.status({ fill: "red", shape: "ring", text: "invalid reset" });
                        if (done) done();
                        return;
                    }
                    if (msg.payload === true) {
                        node.runtime.lastValue = null;
                        node.status({ fill: "green", shape: "dot", text: "state reset" });
                        if (done) done();
                        return;
                    }
                    if (done) done();
                    return;
                }
                // Ignore unknown context, process payload
            }

            // Validate payload
            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing payload" });
                if (done) done();
                return;
            }

            if (typeof msg.payload !== "boolean") {
                node.status({ fill: "red", shape: "ring", text: "invalid input" });
                if (done) done();
                return;
            }

            const currentValue = msg.payload;
            const lastValue = node.runtime.lastValue;

            // Check for transition
            let isTransition = false;
            if (lastValue !== null) {
                if (node.runtime.algorithm === "true-to-false" && lastValue === true && currentValue === false) {
                    isTransition = true;
                } else if (node.runtime.algorithm === "false-to-true" && lastValue === false && currentValue === true) {
                    isTransition = true;
                }
            }

            if (isTransition) {
                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `in: ${currentValue}, out: true`
                });
                send({ payload: true });
            } else {
                node.status({
                    fill: "blue",
                    shape: "ring",
                    text: `in: ${currentValue}, out: none`
                });
            }

            node.runtime.lastValue = currentValue;
            if (done) done();
        });

        node.on("close", function(done) {
            node.runtime.algorithm = config.algorithm || "true-to-false";
            node.runtime.lastValue = null;
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("edge-block", EdgeBlockNode);

    // Serve runtime state for editor
    RED.httpAdmin.get("/edge-block-runtime/:id", RED.auth.needsPermission("edge-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "edge-block") {
            res.json({
                name: node.runtime.name,
                algorithm: node.runtime.algorithm
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};