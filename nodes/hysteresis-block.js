module.exports = function(RED) {
    function HysteresisBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "hysteresis";
        node.upperLimit = parseFloat(config.upperLimit) || 50;
        node.lowerLimit = parseFloat(config.lowerLimit) || 30;

        // Validate initial config
        if (isNaN(node.upperLimit) || isNaN(node.lowerLimit) || node.upperLimit <= node.lowerLimit) {
            node.upperLimit = 50;
            node.lowerLimit = 30;
            node.status({ fill: "red", shape: "ring", text: "invalid limits" });
        }

        // Initialize state
        let prevState = "within";

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (msg.context) {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }

                const value = parseFloat(msg.payload);
                if (isNaN(value)) {
                    node.status({ fill: "red", shape: "ring", text: `invalid ${msg.context}` });
                    if (done) done();
                    return;
                }

                switch (msg.context) {
                    case "upperLimit":
                        if (value <= node.lowerLimit) {
                            node.status({ fill: "red", shape: "ring", text: "invalid upperLimit" });
                            if (done) done();
                            return;
                        }
                        node.upperLimit = value;
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: `upperLimit set: ${value.toFixed(2)}`
                        });
                        if (done) done();
                        return;
                    case "lowerLimit":
                        if (value >= node.upperLimit) {
                            node.status({ fill: "red", shape: "ring", text: "invalid lowerLimit" });
                            if (done) done();
                            return;
                        }
                        node.lowerLimit = value;
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: `lowerLimit set: ${value.toFixed(2)}`
                        });
                        if (done) done();
                        return;
                    default:
                        node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
                        if (done) done();
                        return;
                }
            }

            if (msg.payload === undefined || isNaN(parseFloat(msg.payload))) {
                node.status({ fill: "red", shape: "ring", text: "invalid input" });
                if (done) done();
                return;
            }

            const value = parseFloat(msg.payload);

            // Determine new state
            let newState;
            if (value > node.upperLimit) {
                newState = "above";
            } else if (value < node.lowerLimit) {
                newState = "below";
            } else {
                newState = "within";
            }

            // Handle state change
            if (newState !== prevState) {
                prevState = newState;
                const output = [
                    { payload: false },
                    { payload: false },
                    { payload: false }
                ];
                if (newState === "above") {
                    output[0] = { payload: true };
                } else if (newState === "below") {
                    output[2] = { payload: true };
                } else {
                    output[1] = { payload: true };
                }
                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `out: ${newState}, in: ${value.toFixed(2)}`
                });
                send(output);
            } else {
                node.status({
                    fill: "blue",
                    shape: "ring",
                    text: `out: ${newState}, in: ${value.toFixed(2)}`
                });
            }

            if (done) done();
        });

        node.on("close", function(done) {
            // Reset state and properties on redeployment
            prevState = "within";
            node.upperLimit = parseFloat(config.upperLimit) || 50;
            node.lowerLimit = parseFloat(config.lowerLimit) || 30;

            if (isNaN(node.upperLimit) || isNaN(node.lowerLimit) || node.upperLimit <= node.lowerLimit) {
                node.upperLimit = 50;
                node.lowerLimit = 30;
            }

            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("hysteresis-block", HysteresisBlockNode);

    // Serve dynamic config from runtime
    RED.httpAdmin.get("/hysteresis-block/:id", RED.auth.needsPermission("hysteresis-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "hysteresis-block") {
            res.json({
                name: node.name || "hysteresis",
                upperLimit: !isNaN(node.upperLimit) ? node.upperLimit : 50,
                lowerLimit: !isNaN(node.lowerLimit) ? node.lowerLimit : 30,
                prevState: node.prevState || "within"
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};