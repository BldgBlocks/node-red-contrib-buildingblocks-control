module.exports = function(RED) {
    function OrBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "or";
        node.slots = parseInt(config.slots) || 2;
        if (typeof node.slots !== "number" || node.slots < 2) {
            node.slots = 2;
        }

        // Initialize inputs
        let inputs = Array(node.slots).fill(false);

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (msg.context) {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }
                
                if (msg.context.startsWith("in")) {
                    let index = parseInt(msg.context.slice(2), 10);
                    if (!isNaN(index) && index >= 1 && index <= node.slots) {
                        let value = Boolean(msg.payload);
                        let store = inputs[index - 1];
                        if (store != value) {
                            inputs[index - 1] = value;
                            const result = inputs.some(v => v === true);
                            send({ payload: result });

                            node.status({
                                fill: "blue",
                                shape: "dot",
                                text: `out: ${result}, in: [${inputs.join(", ")}]`
                            });
                        } else {
                            node.status({
                                fill: "blue",
                                shape: "ring",
                                text: `out: ${inputs.some(v => v === true)}, in: [${inputs.join(", ")}]`
                            });
                        }
                        if (done) done();
                        return;
                    } else {
                        node.status({ fill: "red", shape: "ring", text: `invalid input index ${index}` });
                        if (done) done();
                        return;
                    }
                } else {
                    node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
                    if (done) done();
                    return;
                }
            }
        });

        node.on("close", function(done) {
            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("or-block", OrBlockNode);
};