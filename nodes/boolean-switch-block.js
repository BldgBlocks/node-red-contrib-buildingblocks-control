module.exports = function(RED) {
    function BooleanSwitchBlockNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const context = this.context();

        // Initialize runtime state
        node.runtime = {
            name: config.name || "",
            state: context.get("state") !== undefined ? context.get("state") : false
        };

        // Persist initial state
        context.set("state", node.runtime.state);

        // Set initial status
        node.status({
            fill: "green",
            shape: "dot",
            text: `state: ${node.runtime.state}, out: ${node.runtime.state ? "true" : "false"}`
        });

        node.on("input", function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };

            // Guard against invalid message
            if (!msg) {
                node.status({ fill: "red", shape: "ring", text: "invalid message" });
                if (done) done();
                return;
            }

            // Validate context
            if (!msg.hasOwnProperty("context") || typeof msg.context !== "string") {
                node.status({ fill: "red", shape: "ring", text: "missing or invalid context" });
                if (done) done();
                return;
            }

            // Handle context commands
            if (msg.context === "toggle" || msg.context === "switch") {
                node.runtime.state = !node.runtime.state;
                context.set("state", node.runtime.state);
                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `state: ${node.runtime.state}, out: ${node.runtime.state ? "true" : "false"}`
                });
                // Send to outControl (third output)
                send([null, null, { payload: node.runtime.state }]);
                if (done) done();
                return;
            } else if (msg.context === "inTrue") {
                if (node.runtime.state) {
                    node.status({
                        fill: "blue",
                        shape: "dot",
                        text: `state: true, out: true`
                    });
                    // Send to outTrue (first output)
                    send([msg, null, null]);
                }
                if (done) done();
                return;
            } else if (msg.context === "inFalse") {
                if (!node.runtime.state) {
                    node.status({
                        fill: "blue",
                        shape: "dot",
                        text: `state: false, out: false`
                    });
                    // Send to outFalse (second output)
                    send([null, msg, null]);
                }
                if (done) done();
                return;
            } else {
                node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
                if (done) done("Unknown context");
                return;
            }
        });

        node.on("close", function(done) {
            node.status({});
            done();
        });

        // Handle manual toggle via HTTP endpoint
        RED.httpAdmin.post("/boolean-switch-block/:id/toggle", RED.auth.needsPermission("boolean-switch-block.write"), function(req, res) {
            const node = RED.nodes.getNode(req.params.id);
            if (node && node.type === "boolean-switch-block") {
                node.runtime.state = !node.runtime.state;
                context.set("state", node.runtime.state);
                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `state: ${node.runtime.state}, out: ${node.runtime.state ? "true" : "false"}`
                });
                node.send([null, null, { payload: node.runtime.state }]);
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    }

    RED.nodes.registerType("boolean-switch-block", BooleanSwitchBlockNode);

    // Serve runtime state for editor
    RED.httpAdmin.get("/boolean-switch-block-runtime/:id", RED.auth.needsPermission("boolean-switch-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "boolean-switch-block") {
            res.json({
                name: node.runtime.name,
                state: node.runtime.state
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};