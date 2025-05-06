module.exports = function(RED) {
    function PriorityBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "priority";
        
        // Initialize state
        let priorities = {
            priority1: null, priority2: null, priority3: null, priority4: null,
            priority5: null, priority6: null, priority7: null, priority8: null,
            priority9: null, priority10: null, priority11: null, priority12: null,
            priority13: null, priority14: null, priority15: null, priority16: null
        };
        let defaultValue = null;
        let fallbackValue = null;

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (!msg.hasOwnProperty("context")) {
                node.status({ fill: "red", shape: "ring", text: "missing context" });
                if (done) done();
                return;
            }

            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing payload" });
                if (done) done();
                return;
            }

            const context = msg.context;
            const value = msg.payload === null ? null : parseFloat(msg.payload);

            if (/^priority([1-9]|1[0-6])$/.test(context)) {
                if (value !== null && isNaN(value)) {
                    node.status({ fill: "red", shape: "ring", text: `invalid ${context}` });
                    if (done) done();
                    return;
                }
                const store = priorities[context];
                priorities[context] = value;
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: value === null ? `${context} relinquished` : `${context}: ${value.toFixed(2)}`
                });
            } else if (context === "default") {
                if (value !== null && isNaN(value)) {
                    node.status({ fill: "red", shape: "ring", text: "invalid default" });
                    if (done) done();
                    return;
                }
                const store = defaultValue;
                defaultValue = value;
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: value === null ? "default relinquished" : `default: ${value.toFixed(2)}`
                });
            } else if (context === "fallback") {
                if (value !== null && isNaN(value)) {
                    node.status({ fill: "red", shape: "ring", text: "invalid fallback" });
                    if (done) done();
                    return;
                }
                const store = fallbackValue;
                fallbackValue = value;
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: value === null ? "fallback relinquished" : `fallback: ${value.toFixed(2)}`
                });
            } else {
                node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
                if (done) done();
                return;
            }

            const currentOutput = evaluatePriority();
            send(currentOutput);
            node.status({
                fill: "blue",
                shape: "dot",
                text: currentOutput.payload === null ? "out: null, no priority" : `out: ${currentOutput.payload.toFixed(2)}, ${currentOutput.diagnostics.activePriority}`
            });

            if (done) done();
            return;

            function evaluatePriority() {
                let selectedValue = null;
                let activePriority = null;

                // Check priorities from 1 to 16
                for (let i = 1; i <= 16; i++) {
                    const key = `priority${i}`;
                    if (priorities[key] !== null) {
                        selectedValue = priorities[key];
                        activePriority = key;
                        break;
                    }
                }

                // Fall back to default or fallback
                if (selectedValue === null) {
                    if (defaultValue !== null) {
                        selectedValue = defaultValue;
                        activePriority = "default";
                    } else if (fallbackValue !== null) {
                        selectedValue = fallbackValue;
                        activePriority = "fallback";
                    }
                }

                return {
                    payload: selectedValue,
                    diagnostics: { activePriority }
                };
            }
        });

        node.on("close", function(done) {
            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("priority-block", PriorityBlockNode);

    // Serve dynamic config from runtime
    RED.httpAdmin.get("/priority-block/:id", RED.auth.needsPermission("priority-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "priority-block") {
            res.json({
                name: node.name || "priority"
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};