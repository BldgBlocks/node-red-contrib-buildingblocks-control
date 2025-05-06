module.exports = function(RED) {
    function CompareBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "compare";
        node.setpoint = parseFloat(config.setpoint) || 50;
        if (typeof node.setpoint !== "number" || isNaN(node.setpoint)) {
            node.setpoint = 50;
            node.status({ fill: "red", shape: "ring", text: "invalid setpoint" });
        }

        // Store last input value to check for changes
        let lastInput = null;

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (msg.context) {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }
                
                if (msg.context === "setpoint") {
                    const setpointValue = parseFloat(msg.payload);
                    if (typeof setpointValue === "number" && !isNaN(setpointValue)) {
                        node.setpoint = setpointValue;
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: `setpoint: ${setpointValue.toFixed(2)}`
                        });
                    } else {
                        node.status({ fill: "red", shape: "ring", text: "invalid setpoint" });
                    }
                    if (done) done();
                    return;
                } else {
                    node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
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
            if (typeof inputValue !== "number" || isNaN(inputValue)) {
                node.status({ fill: "red", shape: "ring", text: "invalid input" });
                if (done) done();
                return;
            }

            // Compare input to setpoint
            const greater = inputValue > node.setpoint;
            const equal = inputValue === node.setpoint;
            const less = inputValue < node.setpoint;
            const outputs = [
                { payload: greater },
                { payload: equal },
                { payload: less }
            ];

            // Check if input value has changed
            if (lastInput !== inputValue) {
                lastInput = inputValue;
                send(outputs);

                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `in: ${inputValue.toFixed(2)}, sp: ${node.setpoint.toFixed(2)}, out: [${greater}, ${equal}, ${less}]`
                });
            } else {
                node.status({
                    fill: "blue",
                    shape: "ring",
                    text: `in: ${inputValue.toFixed(2)}, sp: ${node.setpoint.toFixed(2)}, out: [${greater}, ${equal}, ${less}]`
                });
            }

            if (done) done();
            return;
        });

        node.on("close", function(done) {
            // Reset setpoint to config value on redeployment
            node.setpoint = parseFloat(config.setpoint) || 50;
            if (typeof node.setpoint !== "number" || isNaN(node.setpoint)) {
                node.setpoint = 50;
            }
            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("compare-block", CompareBlockNode);

    // Serve dynamic config from runtime
    RED.httpAdmin.get("/compare-block/:id", RED.auth.needsPermission("compare-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "compare-block") {
            res.json({
                name: node.name || "compare",
                setpoint: typeof node.setpoint === "number" && !isNaN(node.setpoint) ? node.setpoint : 50
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};